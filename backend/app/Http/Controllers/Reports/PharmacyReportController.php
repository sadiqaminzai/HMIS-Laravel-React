<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use App\Models\HospitalSetting;
use App\Models\Medicine;
use App\Models\Stock;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use App\Support\PharmacyCosting;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

/**
 * The pharmacy tab of the Reports module.
 *
 * These reports are computed HERE rather than in the browser. The previous
 * client-side implementation fetched `per_page: 200` and aggregated in React,
 * which on a 900-line formulary silently reported on the first 200 medicines
 * alphabetically -- an Available Stock report that stops at the letter D is
 * worse than no report, because nothing on screen says it is incomplete.
 *
 * Every method returns the same envelope so the frontend table, the Excel
 * export and the PDF export can share one renderer:
 *
 *   { rows: [...], summary: {...}, meta: {...} }
 */
class PharmacyReportController extends Controller
{
    /**
     * Available Stock.
     *
     * Product wise (default) is one row per medicine; company wise rolls those
     * up by manufacturer. Quantity is reported in packs AND pieces because the
     * two audiences differ: a pharmacist counts boxes on a shelf, a stock-take
     * counts pieces.
     */
    public function availableStock(Request $request)
    {
        $hospitalId = $this->hospitalId($request);
        $groupBy = $request->string('group_by')->toString() ?: 'product';

        $rows = $groupBy === 'company'
            ? $this->availableStockByCompany($hospitalId)
            : $this->availableStockByProduct($hospitalId, $request);

        return response()->json([
            'rows' => $rows,
            'summary' => [
                'lines' => $rows->count(),
                'total_pieces' => (int) $rows->sum('qty_pieces'),
                'total_value' => round((float) $rows->sum('stock_value'), 2),
            ],
            'meta' => ['group_by' => $groupBy],
        ]);
    }

    private function availableStockByProduct(?int $hospitalId, Request $request)
    {
        /*
         * Expiry comes from the `stocks` table, not from `medicines.stock`.
         *
         * medicines.stock is a denormalised running total; stocks holds the
         * batches that make it up, and only the batches carry expiry dates. A
         * product-wise row therefore reports the EARLIEST expiry across its
         * batches, because that is the one that will bite first.
         */
        $batches = Stock::query()
            ->when($hospitalId, fn ($q) => $q->where('stocks.hospital_id', $hospitalId))
            ->groupBy('stocks.medicine_id')
            ->selectRaw('stocks.medicine_id')
            ->selectRaw('SUM(COALESCE(stocks.stock_qty, 0) + COALESCE(stocks.bonus_qty, 0)) as batch_pieces')
            ->selectRaw('MIN(stocks.expiry_date) as earliest_expiry')
            ->selectRaw('COUNT(*) as batch_count');

        $query = Medicine::query()
            ->when($hospitalId, fn ($q) => $q->where('medicines.hospital_id', $hospitalId))
            ->leftJoinSub($batches, 'b', 'b.medicine_id', '=', 'medicines.id')
            ->leftJoinSub(PharmacyCosting::unitCosts($hospitalId), 'uc', 'uc.medicine_id', '=', 'medicines.id')
            ->leftJoin('manufacturers', 'manufacturers.id', '=', 'medicines.manufacturer_id')
            ->leftJoin('medicine_types', 'medicine_types.id', '=', 'medicines.medicine_type_id');

        // Zero-stock lines are noise on an availability report unless asked for.
        if (!$request->boolean('include_zero')) {
            $query->where(function ($q) {
                $q->where('medicines.stock', '>', 0)->orWhere('b.batch_pieces', '>', 0);
            });
        }

        if ($request->filled('manufacturer_id')) {
            $query->where('medicines.manufacturer_id', $request->integer('manufacturer_id'));
        }

        $unitCost = PharmacyCosting::unitCostExpression();

        return $query
            ->selectRaw('medicines.id, medicines.brand_name, medicines.generic_name, medicines.strength')
            ->selectRaw('medicines.stock, medicines.pack_size, medicines.pack_label, medicines.min_stock')
            ->selectRaw('medicines.sale_price, medicines.cost_price')
            ->selectRaw('manufacturers.name as manufacturer_name')
            ->selectRaw('medicine_types.name as type_name')
            ->selectRaw('b.earliest_expiry as earliest_expiry')
            ->selectRaw('COALESCE(b.batch_count, 0) as batch_count')
            ->selectRaw('COALESCE(medicines.stock, 0) * ' . $unitCost . ' as stock_value')
            ->orderBy('medicines.brand_name')
            ->orderBy('medicines.id')
            ->get()
            ->map(fn ($row) => $this->decorateProductRow($row));
    }

    private function availableStockByCompany(?int $hospitalId)
    {
        $unitCost = PharmacyCosting::unitCostExpression();

        return Medicine::query()
            ->when($hospitalId, fn ($q) => $q->where('medicines.hospital_id', $hospitalId))
            ->leftJoinSub(PharmacyCosting::unitCosts($hospitalId), 'uc', 'uc.medicine_id', '=', 'medicines.id')
            ->leftJoin('manufacturers', 'manufacturers.id', '=', 'medicines.manufacturer_id')
            ->groupBy('medicines.manufacturer_id', 'manufacturers.name')
            ->selectRaw('medicines.manufacturer_id')
            ->selectRaw("COALESCE(manufacturers.name, 'Unassigned') as manufacturer_name")
            ->selectRaw('COUNT(*) as product_count')
            ->selectRaw('SUM(COALESCE(medicines.stock, 0)) as qty_pieces')
            ->selectRaw('SUM(CASE WHEN COALESCE(medicines.stock, 0) <= 0 THEN 1 ELSE 0 END) as out_of_stock_count')
            ->selectRaw('SUM(COALESCE(medicines.stock, 0) * ' . $unitCost . ') as stock_value')
            ->orderBy('manufacturers.name')
            ->get()
            ->map(fn ($row) => [
                'manufacturer_id' => $row->manufacturer_id,
                'manufacturer_name' => $row->manufacturer_name,
                'product_count' => (int) $row->product_count,
                'out_of_stock_count' => (int) $row->out_of_stock_count,
                'qty_pieces' => (int) $row->qty_pieces,
                'stock_value' => round((float) $row->stock_value, 2),
            ]);
    }

    /**
     * Purchase Report -- supplier wise and date wise.
     *
     * `group_by=supplier` gives one row per supplier for the period;
     * `group_by=date` gives one row per day; the default `detail` lists the
     * individual purchase documents so a line can be traced to its invoice.
     */
    public function purchases(Request $request)
    {
        return $this->tradeReport($request, 'purchase', 'purchase_return');
    }

    /**
     * Sales Report. Mirror image of the purchase report, with sales returns
     * netted off rather than counted as separate income.
     */
    public function sales(Request $request)
    {
        return $this->tradeReport($request, 'sales', 'sales_return');
    }

    private function tradeReport(Request $request, string $type, string $returnType)
    {
        $hospitalId = $this->hospitalId($request);
        [$from, $to] = $this->dateRange($request);
        $groupBy = $request->string('group_by')->toString() ?: 'detail';
        $isPurchase = $type === 'purchase';

        $base = Transaction::query()
            ->when($hospitalId, fn ($q) => $q->where('transactions.hospital_id', $hospitalId))
            ->whereIn('transactions.trx_type', [$type, $returnType])
            ->whereBetween('transactions.created_at', [$from, $to]);

        if ($isPurchase && $request->filled('supplier_id')) {
            $base->where('transactions.supplier_id', $request->integer('supplier_id'));
        }

        /*
         * Returns carry a negative sign throughout. A purchase report that adds
         * a 5,000 purchase to a 5,000 return and calls it 10,000 of buying is
         * not something anyone can reconcile against a bank statement.
         */
        $sign = "CASE WHEN transactions.trx_type = '" . $returnType . "' THEN -1 ELSE 1 END";

        if ($groupBy === 'date') {
            $rows = (clone $base)
                ->groupByRaw('DATE(transactions.created_at)')
                ->selectRaw('DATE(transactions.created_at) as day')
                ->selectRaw('COUNT(*) as document_count')
                ->selectRaw("SUM({$sign} * COALESCE(transactions.grand_total, 0)) as net_total")
                ->selectRaw("SUM({$sign} * COALESCE(transactions.total_discount, 0)) as discount_total")
                ->selectRaw("SUM({$sign} * COALESCE(transactions.paid_amount, 0)) as paid_total")
                ->selectRaw("SUM({$sign} * COALESCE(transactions.due_amount, 0)) as due_total")
                ->orderBy('day')
                ->get()
                ->map(fn ($r) => [
                    'day' => (string) $r->day,
                    'document_count' => (int) $r->document_count,
                    'net_total' => round((float) $r->net_total, 2),
                    'discount_total' => round((float) $r->discount_total, 2),
                    'paid_total' => round((float) $r->paid_total, 2),
                    'due_total' => round((float) $r->due_total, 2),
                ]);
        } elseif ($groupBy === 'supplier' || $groupBy === 'customer') {
            $labelColumn = $isPurchase ? 'transactions.supplier_name' : 'transactions.patient_name';
            $idColumn = $isPurchase ? 'transactions.supplier_id' : 'transactions.patient_id';

            $rows = (clone $base)
                ->groupByRaw($idColumn . ', ' . $labelColumn)
                ->selectRaw($idColumn . ' as party_id')
                ->selectRaw("COALESCE({$labelColumn}, 'Walk-in / Unnamed') as party_name")
                ->selectRaw('COUNT(*) as document_count')
                ->selectRaw("SUM({$sign} * COALESCE(transactions.grand_total, 0)) as net_total")
                ->selectRaw("SUM({$sign} * COALESCE(transactions.total_discount, 0)) as discount_total")
                ->selectRaw("SUM({$sign} * COALESCE(transactions.paid_amount, 0)) as paid_total")
                ->selectRaw("SUM({$sign} * COALESCE(transactions.due_amount, 0)) as due_total")
                ->orderByDesc('net_total')
                ->get()
                ->map(fn ($r) => [
                    'party_id' => $r->party_id,
                    'party_name' => $r->party_name,
                    'document_count' => (int) $r->document_count,
                    'net_total' => round((float) $r->net_total, 2),
                    'discount_total' => round((float) $r->discount_total, 2),
                    'paid_total' => round((float) $r->paid_total, 2),
                    'due_total' => round((float) $r->due_total, 2),
                ]);
        } else {
            $rows = (clone $base)
                ->orderByDesc('transactions.created_at')
                ->get([
                    'id', 'serial_no', 'trx_type', 'created_at',
                    'supplier_name', 'patient_name', 'is_walk_in',
                    'grand_total', 'total_discount', 'paid_amount', 'due_amount',
                    'payment_status', 'payment_method',
                ])
                ->map(fn ($r) => [
                    'id' => $r->id,
                    'serial_no' => $r->serial_no,
                    'trx_type' => $r->trx_type,
                    'is_return' => $r->trx_type === $returnType,
                    'date' => optional($r->created_at)->toDateString(),
                    'party_name' => $isPurchase
                        ? ($r->supplier_name ?: '-')
                        : ($r->patient_name ?: 'Walk-in'),
                    'grand_total' => round((float) $r->grand_total, 2),
                    'total_discount' => round((float) $r->total_discount, 2),
                    'paid_amount' => round((float) $r->paid_amount, 2),
                    'due_amount' => round((float) $r->due_amount, 2),
                    'payment_status' => $r->payment_status,
                    'payment_method' => $r->payment_method,
                ]);
        }

        $totals = (clone $base)
            ->selectRaw("COALESCE(SUM({$sign} * COALESCE(transactions.grand_total, 0)), 0) as net_total")
            ->selectRaw("COALESCE(SUM({$sign} * COALESCE(transactions.paid_amount, 0)), 0) as paid_total")
            ->selectRaw("COALESCE(SUM({$sign} * COALESCE(transactions.due_amount, 0)), 0) as due_total")
            ->selectRaw("COALESCE(SUM(CASE WHEN transactions.trx_type = '{$returnType}'"
                . ' THEN COALESCE(transactions.grand_total, 0) ELSE 0 END), 0) as return_total')
            ->first();

        return response()->json([
            'rows' => $rows,
            'summary' => [
                'net_total' => round((float) $totals->net_total, 2),
                'paid_total' => round((float) $totals->paid_total, 2),
                'due_total' => round((float) $totals->due_total, 2),
                'return_total' => round((float) $totals->return_total, 2),
                'lines' => $rows->count(),
            ],
            'meta' => [
                'group_by' => $groupBy,
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ],
        ]);
    }

    /**
     * Short Expiry.
     *
     * Batch-level, because expiry is a property of a batch and not of a
     * product: a medicine can hold one box expiring next month and forty boxes
     * good for two years, and a product-level "expiry date" would either panic
     * about the forty or ignore the one.
     *
     * Already-expired batches are returned alongside the expiring ones and
     * flagged, never silently dropped -- expired stock still sitting on the
     * shelf is the most urgent thing this report has to say.
     */
    public function shortExpiry(Request $request)
    {
        $hospitalId = $this->hospitalId($request);
        $today = CarbonImmutable::today();

        /*
         * Two ways to ask the same question, because two people ask it
         * differently.
         *
         * A pharmacist asks "what goes off in the next N days" and wants a
         * rolling window -- 30, 60, 90, or a number they type, which is why
         * `days` is a free integer rather than an enum of the preset buttons.
         *
         * A manager writing off stock asks "what expires between these two
         * dates" and wants a fixed window that does not move tomorrow. An
         * explicit date_from/date_to wins over `days` when both arrive.
         */
        $days = $request->filled('days')
            ? max(1, min($request->integer('days'), 3650))
            : $this->setting($hospitalId, 'short_expiry_days', 90);

        $usesExplicitRange = $request->filled('date_from') || $request->filled('date_to');

        if ($usesExplicitRange) {
            $windowStart = $request->filled('date_from')
                ? CarbonImmutable::parse($request->string('date_from')->toString())->startOfDay()
                : null;
            $cutoff = $request->filled('date_to')
                ? CarbonImmutable::parse($request->string('date_to')->toString())->endOfDay()
                : $today->addDays($days);

            // Entered backwards is a slip, not a request for nothing.
            if ($windowStart && $windowStart->greaterThan($cutoff)) {
                [$windowStart, $cutoff] = [$cutoff->startOfDay(), $windowStart->endOfDay()];
            }
        } else {
            $windowStart = null;
            $cutoff = $today->addDays($days);
        }

        $query = Stock::query()
            ->when($hospitalId, fn ($q) => $q->where('stocks.hospital_id', $hospitalId))
            ->leftJoin('medicines', 'medicines.id', '=', 'stocks.medicine_id')
            ->leftJoin('manufacturers', 'manufacturers.id', '=', 'medicines.manufacturer_id')
            ->leftJoin('medicine_types', 'medicine_types.id', '=', 'medicines.medicine_type_id')
            ->whereNotNull('stocks.expiry_date')
            ->where('stocks.expiry_date', '<=', $cutoff->toDateString())
            // A batch with nothing left in it cannot expire into a loss.
            ->whereRaw('COALESCE(stocks.stock_qty, 0) + COALESCE(stocks.bonus_qty, 0) > 0');

        // Only a deliberate From date hides already-expired stock. The rolling
        // window never does: expired goods still on the shelf are the most
        // urgent thing this report has to say, and a lower bound of "today"
        // would quietly drop them.
        if ($windowStart) {
            $query->where('stocks.expiry_date', '>=', $windowStart->toDateString());
        }

        if ($request->filled('medicine_id')) {
            $query->where('stocks.medicine_id', $request->integer('medicine_id'));
        }

        if ($request->filled('manufacturer_id')) {
            $query->where('medicines.manufacturer_id', $request->integer('manufacturer_id'));
        }

        $rows = $query
            ->selectRaw('stocks.id, stocks.medicine_id, stocks.batch_no, stocks.expiry_date')
            ->selectRaw('COALESCE(stocks.stock_qty, 0) + COALESCE(stocks.bonus_qty, 0) as qty_pieces')
            ->selectRaw('stocks.purchase_price, stocks.sale_price')
            ->selectRaw('medicines.brand_name, medicines.generic_name, medicines.strength')
            ->selectRaw('medicines.pack_size, medicines.pack_label')
            ->selectRaw('manufacturers.name as manufacturer_name')
            ->selectRaw('medicine_types.name as type_name')
            ->orderBy('stocks.expiry_date')
            ->get()
            ->map(function ($row) use ($today) {
                $expiry = $row->expiry_date ? CarbonImmutable::parse($row->expiry_date) : null;
                // Signed, so an already-expired batch reads as a negative
                // number of days rather than silently as "0 days left".
                $daysLeft = $expiry ? $today->diffInDays($expiry, false) : null;
                $packSize = max(1, (int) $row->pack_size);
                $pieces = (int) $row->qty_pieces;

                return [
                    'stock_id' => $row->id,
                    'medicine_id' => $row->medicine_id,
                    'product_name' => $this->productName($row),
                    'manufacturer_name' => $row->manufacturer_name ?: '-',
                    'batch_no' => $row->batch_no ?: '-',
                    'expiry_date' => $expiry ? $expiry->toDateString() : null,
                    'days_left' => $daysLeft !== null ? (int) $daysLeft : null,
                    'is_expired' => $daysLeft !== null && $daysLeft < 0,
                    'qty_pieces' => $pieces,
                    'qty_packs' => round($pieces / $packSize, 2),
                    'qty_label' => $this->packLabel($pieces, $packSize, $row->pack_label, $row->type_name),
                    // stocks.purchase_price is quoted per pack, like every
                    // other price in this system, so it converts before it
                    // multiplies a piece count.
                    'value_at_cost' => round($pieces * ((float) $row->purchase_price / $packSize), 2),
                ];
            });

        $expired = $rows->where('is_expired', true);
        $expiring = $rows->where('is_expired', false);

        return response()->json([
            'rows' => $rows->values(),
            'summary' => [
                'lines' => $rows->count(),
                'expired_lines' => $expired->count(),
                'expired_value' => round((float) $expired->sum('value_at_cost'), 2),
                'expiring_lines' => $expiring->count(),
                'expiring_value' => round((float) $expiring->sum('value_at_cost'), 2),
            ],
            'meta' => [
                'days' => $days,
                'mode' => $usesExplicitRange ? 'range' : 'rolling',
                'from' => $windowStart ? $windowStart->toDateString() : null,
                'cutoff' => $cutoff->toDateString(),
            ],
        ]);
    }

    /**
     * Low Stock -- what needs reordering.
     *
     * The threshold is per product (medicines.min_stock, in packs) with a
     * hospital-wide fallback, NOT the flat "10 pieces" the dashboard donut used
     * to apply to tablets, syrups and injections alike.
     */
    public function lowStock(Request $request)
    {
        $hospitalId = $this->hospitalId($request);
        $defaultMinPacks = $this->setting($hospitalId, 'default_min_stock_packs', 5);
        $threshold = PharmacyCosting::thresholdPiecesExpression($defaultMinPacks);

        $query = Medicine::query()
            ->when($hospitalId, fn ($q) => $q->where('medicines.hospital_id', $hospitalId))
            ->leftJoinSub(PharmacyCosting::unitCosts($hospitalId), 'uc', 'uc.medicine_id', '=', 'medicines.id')
            ->leftJoin('manufacturers', 'manufacturers.id', '=', 'medicines.manufacturer_id')
            ->leftJoin('medicine_types', 'medicine_types.id', '=', 'medicines.medicine_type_id')
            ->whereRaw('COALESCE(medicines.stock, 0) <= ' . $threshold);

        if ($request->filled('manufacturer_id')) {
            $query->where('medicines.manufacturer_id', $request->integer('manufacturer_id'));
        }

        // Out of stock is the more urgent half of the same question, so it is
        // included by default and separable by the `status` filter.
        $status = $request->string('status')->toString();
        if ($status === 'out') {
            $query->whereRaw('COALESCE(medicines.stock, 0) <= 0');
        } elseif ($status === 'low') {
            $query->whereRaw('COALESCE(medicines.stock, 0) > 0');
        }

        $unitCost = PharmacyCosting::unitCostExpression();

        $rows = $query
            ->selectRaw('medicines.id, medicines.brand_name, medicines.generic_name, medicines.strength')
            ->selectRaw('medicines.stock, medicines.min_stock, medicines.pack_size, medicines.pack_label')
            ->selectRaw('medicines.cost_price, medicines.sale_price')
            ->selectRaw('manufacturers.name as manufacturer_name')
            ->selectRaw('medicine_types.name as type_name')
            ->selectRaw($threshold . ' as threshold_pieces')
            ->selectRaw('GREATEST(' . $threshold . ' - COALESCE(medicines.stock, 0), 0) * '
                . $unitCost . ' as reorder_value')
            // Emptiest first: the shelf that is already bare matters more than
            // the one that is merely getting there.
            ->orderByRaw('COALESCE(medicines.stock, 0) ASC')
            ->orderBy('medicines.brand_name')
            ->get()
            ->map(function ($row) use ($defaultMinPacks) {
                $packSize = max(1, (int) $row->pack_size);
                $pieces = (int) $row->stock;
                $thresholdPieces = (int) $row->threshold_pieces;
                $shortfall = max(0, $thresholdPieces - $pieces);

                return [
                    'id' => $row->id,
                    'product_name' => $this->productName($row),
                    'manufacturer_name' => $row->manufacturer_name ?: '-',
                    'qty_pieces' => $pieces,
                    'qty_packs' => round($pieces / $packSize, 2),
                    'qty_label' => $this->packLabel($pieces, $packSize, $row->pack_label, $row->type_name),
                    'min_stock_packs' => $row->min_stock !== null ? (int) $row->min_stock : $defaultMinPacks,
                    // The table marks inherited thresholds so a pharmacist can
                    // see at a glance which products nobody has configured yet.
                    'min_stock_is_default' => $row->min_stock === null,
                    'threshold_pieces' => $thresholdPieces,
                    'shortfall_pieces' => $shortfall,
                    'shortfall_packs' => round($shortfall / $packSize, 2),
                    'status' => $pieces <= 0 ? 'out_of_stock' : 'low_stock',
                    'reorder_value' => round((float) $row->reorder_value, 2),
                ];
            });

        return response()->json([
            'rows' => $rows,
            'summary' => [
                'lines' => $rows->count(),
                'out_of_stock' => $rows->where('status', 'out_of_stock')->count(),
                'low_stock' => $rows->where('status', 'low_stock')->count(),
                'reorder_value' => round((float) $rows->sum('reorder_value'), 2),
            ],
            'meta' => [
                'default_min_stock_packs' => $defaultMinPacks,
                'configured_products' => Medicine::query()
                    ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->whereNotNull('min_stock')
                    ->count(),
            ],
        ]);
    }

    /**
     * Profit Report.
     *
     * Revenue minus cost of goods sold, per product, over a date range. Uses
     * the same weighted-average unit cost as the dashboard's stock valuation
     * (see PharmacyCosting) so the two can never disagree about what a pack
     * cost.
     *
     * This is gross margin on medicine only. It deliberately does not subtract
     * salaries, rent or other overheads -- those belong to the Accounts module,
     * and folding them in here would make a per-product margin meaningless.
     */
    public function profit(Request $request)
    {
        $hospitalId = $this->hospitalId($request);
        [$from, $to] = $this->dateRange($request);

        $sign = "CASE WHEN transactions.trx_type = 'sales_return' THEN -1 ELSE 1 END";
        $unitCost = PharmacyCosting::unitCostExpression();
        // Bonus pieces leave the shelf and have to be paid for out of the
        // margin on what was charged, so they count towards cost but not
        // towards revenue.
        $piecesOut = '(COALESCE(transaction_details.base_qtty, 0) + COALESCE(transaction_details.base_bonus, 0))';

        $query = TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.trx_id')
            ->leftJoinSub(
                PharmacyCosting::unitCosts($hospitalId),
                'uc',
                'uc.medicine_id',
                '=',
                'transaction_details.medicine_id'
            )
            ->leftJoin('medicines', 'medicines.id', '=', 'transaction_details.medicine_id')
            ->leftJoin('manufacturers', 'manufacturers.id', '=', 'medicines.manufacturer_id')
            ->leftJoin('medicine_types', 'medicine_types.id', '=', 'medicines.medicine_type_id')
            ->whereIn('transactions.trx_type', ['sales', 'sales_return'])
            ->when($hospitalId, fn ($q) => $q->where('transactions.hospital_id', $hospitalId))
            ->whereBetween('transactions.created_at', [$from, $to]);

        if ($request->filled('manufacturer_id')) {
            $query->where('medicines.manufacturer_id', $request->integer('manufacturer_id'));
        }

        $rows = $query
            ->groupBy(
                'transaction_details.medicine_id',
                'medicines.brand_name',
                'medicines.generic_name',
                'medicines.strength',
                'medicines.pack_size',
                'medicines.pack_label',
                'manufacturers.name',
                'medicine_types.name'
            )
            ->selectRaw('transaction_details.medicine_id as id')
            ->selectRaw('medicines.brand_name, medicines.generic_name, medicines.strength')
            ->selectRaw('medicines.pack_size, medicines.pack_label')
            ->selectRaw('manufacturers.name as manufacturer_name')
            ->selectRaw('medicine_types.name as type_name')
            ->selectRaw("SUM({$sign} * {$piecesOut}) as qty_pieces")
            // `amount` is net of the line discount, so revenue is what was
            // actually billed rather than list price.
            ->selectRaw("SUM({$sign} * COALESCE(transaction_details.amount, 0)) as revenue")
            ->selectRaw("SUM({$sign} * {$piecesOut} * {$unitCost}) as cogs")
            ->orderByRaw('revenue DESC')
            ->get()
            ->map(function ($row) {
                $packSize = max(1, (int) $row->pack_size);
                $revenue = round((float) $row->revenue, 2);
                $cogs = round((float) $row->cogs, 2);
                $profit = round($revenue - $cogs, 2);
                $pieces = (int) $row->qty_pieces;

                return [
                    'id' => $row->id,
                    'product_name' => $this->productName($row),
                    'manufacturer_name' => $row->manufacturer_name ?: '-',
                    'qty_pieces' => $pieces,
                    'qty_packs' => round($pieces / $packSize, 2),
                    'qty_label' => $this->packLabel($pieces, $packSize, $row->pack_label, $row->type_name),
                    'revenue' => $revenue,
                    'cogs' => $cogs,
                    'profit' => $profit,
                    // Guarded against a zero-revenue line -- a pure return, or
                    // a fully discounted give-away -- dividing by zero.
                    'margin_percent' => $revenue != 0.0 ? round($profit / $revenue * 100, 2) : null,
                ];
            });

        $revenueTotal = (float) $rows->sum('revenue');
        $profitTotal = (float) $rows->sum('profit');

        return response()->json([
            'rows' => $rows,
            'summary' => [
                'lines' => $rows->count(),
                'revenue' => round($revenueTotal, 2),
                'cogs' => round((float) $rows->sum('cogs'), 2),
                'profit' => round($profitTotal, 2),
                'margin_percent' => $revenueTotal != 0.0
                    ? round($profitTotal / $revenueTotal * 100, 2)
                    : null,
            ],
            'meta' => ['from' => $from->toDateString(), 'to' => $to->toDateString()],
        ]);
    }

    /* ------------------------------------------------------------------ */

    private function decorateProductRow($row): array
    {
        $packSize = max(1, (int) $row->pack_size);
        $pieces = (int) $row->stock;

        return [
            'id' => $row->id,
            'product_name' => $this->productName($row),
            'brand_name' => $row->brand_name,
            'generic_name' => $row->generic_name,
            'strength' => $row->strength,
            'type_name' => $row->type_name,
            'manufacturer_name' => $row->manufacturer_name ?: '-',
            'qty_pieces' => $pieces,
            'qty_packs' => round($pieces / $packSize, 2),
            'qty_label' => $this->packLabel($pieces, $packSize, $row->pack_label, $row->type_name),
            'batch_count' => (int) $row->batch_count,
            'earliest_expiry' => $row->earliest_expiry
                ? CarbonImmutable::parse($row->earliest_expiry)->toDateString()
                : null,
            'cost_price' => round((float) $row->cost_price, 2),
            'sale_price' => round((float) $row->sale_price, 2),
            'stock_value' => round((float) $row->stock_value, 2),
        ];
    }

    /**
     * Brand + Strength + Type: "Risek 20mg Capsule".
     *
     * The generic name is deliberately left out. It belongs on a prescription
     * screen, where the formula is the point, but in a report it is the longest
     * part of the label and pushes every other column off the page -- a single
     * row read "Anafortan Plus - Phloroplucinol+Trimethyl Phologlucinol -
     * Tablet" before the table had shown a quantity. The generic is still
     * searchable from Master Data, which is where someone goes to look it up.
     *
     * Built here rather than in the browser so the table, the Excel export and
     * the PDF export cannot each name the same product differently.
     */
    private function productName($row): string
    {
        return collect([
            $row->brand_name,
            $row->strength,
            $row->type_name,
        ])->filter(fn ($part) => filled(trim((string) $part)))
            ->implode(' ');
    }

    /**
     * "46 Pack + 10 Tablet" -- how a pharmacist reads a shelf, from a piece count.
     */
    private function packLabel(int $pieces, int $packSize, ?string $packLabel, ?string $typeName): string
    {
        $unit = trim((string) ($typeName ?: 'Piece'));

        if ($packSize <= 1) {
            return $pieces . ' ' . $unit;
        }

        $packs = intdiv($pieces, $packSize);
        $loose = $pieces % $packSize;
        $packWord = trim((string) ($packLabel ?: 'Pack'));

        $parts = [];
        if ($packs > 0) {
            $parts[] = $packs . ' ' . $packWord;
        }
        if ($loose > 0 || $packs === 0) {
            $parts[] = $loose . ' ' . $unit;
        }

        return implode(' + ', $parts);
    }

    /**
     * Which hospital's data this request may see.
     *
     * A non-super-admin is pinned to their own hospital regardless of what the
     * query string asks for; only a super admin may pick one. Null for a super
     * admin with no selection means "all hospitals".
     */
    private function hospitalId(Request $request): ?int
    {
        $user = $request->user();

        if ($user && $user->role !== 'super_admin') {
            return (int) ($user->hospital_id ?? 0);
        }

        return $request->filled('hospital_id') ? $request->integer('hospital_id') : null;
    }

    /**
     * Inclusive day range. `to` is pushed to the end of its day, or a report
     * run "1 Sep to 1 Sep" would return only rows stamped exactly midnight.
     */
    private function dateRange(Request $request): array
    {
        $from = $request->filled('date_from')
            ? CarbonImmutable::parse($request->string('date_from')->toString())->startOfDay()
            : CarbonImmutable::today()->startOfMonth();

        $to = $request->filled('date_to')
            ? CarbonImmutable::parse($request->string('date_to')->toString())->endOfDay()
            : CarbonImmutable::today()->endOfDay();

        // A range entered backwards is a slip, not a request for no rows.
        return $from->greaterThan($to) ? [$to->startOfDay(), $from->endOfDay()] : [$from, $to];
    }

    private function setting(?int $hospitalId, string $column, int $fallback): int
    {
        if (!$hospitalId) {
            return $fallback;
        }

        $value = HospitalSetting::query()
            ->where('hospital_id', $hospitalId)
            ->value($column);

        return $value !== null ? (int) $value : $fallback;
    }
}
