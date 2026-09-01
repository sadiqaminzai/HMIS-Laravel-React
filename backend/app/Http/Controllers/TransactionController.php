<?php

namespace App\Http\Controllers;

use App\Models\Medicine;
use App\Models\Patient;
use App\Models\Stock;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\HospitalSetting;
use App\Models\Transaction;
use App\Models\WalkInPatient;
use App\Services\LedgerPostingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class TransactionController extends Controller
{
    public function __construct(private readonly LedgerPostingService $ledgerPostingService)
    {
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $query = Transaction::query()->with(['details.medicine', 'supplier', 'patient', 'walkInPatient']);

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('trx_type')) {
            $query->where('trx_type', $request->string('trx_type'));
        }

        // Pagination is retained so no single query/response is huge; clients that
        // need the full list page through it. The ceiling is only a memory guard.
        $perPage = max(1, min($request->integer('per_page', 25), 1000));

        // id tiebreaker keeps paging stable when rows share a created_at timestamp.
        return response()->json($query->orderByDesc('created_at')->orderByDesc('id')->paginate($perPage));
    }

    public function store(Request $request)
    {
        $this->authorizeTransactionAction($request->user(), 'add_transactions');

        $data = $this->validatePayload($request);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        }

        $this->resolveWalkInCustomer($data, (int) $data['hospital_id'], $request->user()->name ?? null);
        $this->ensurePartyConsistency($data);
        $this->fillPartyNames($data);

        $transaction = DB::transaction(function () use ($data, $request) {
            // Convert pack lines into base pieces before anything touches stock.
            $items = $this->withSaleUnits($data['items'] ?? []);
            unset($data['items']);

            $this->ensureStockAvailable(
                (int) ($data['hospital_id'] ?? $request->user()->hospital_id),
                (string) ($data['trx_type'] ?? ''),
                $items,
                true
            );

            $data['created_by'] = $data['created_by'] ?? ($request->user()->name ?? null);
            $data['updated_by'] = $data['updated_by'] ?? ($request->user()->name ?? null);

            $data['total_discount'] = $data['total_discount'] ?? 0;
            $data['total_tax'] = $data['total_tax'] ?? 0;

            // Stating that money was received is a financial act, not part of
            // writing the document. A user without that right can raise the
            // invoice; the counter settles it afterwards.
            // Two different rights, deliberately.
            //
            // Typing an amount on the invoice is recording a payment, so the
            // posted value is only accepted from record_finance_payments -- the
            // same rule that disables the field in the UI.
            //
            $mayTypePayment = $request->user()?->hasAnyPermission([
                'record_finance_payments',
                'manage_finance',
            ]) ?? false;

            // A configured "starts as Paid" default is applied only when the
            // invoice is created and only for a user who is authorised to
            // settle payment. It never participates in the update path.
            $maySettleByDefault = $mayTypePayment
                || ($request->user()?->hasPermission('edit_finance_payment_status') ?? false);

            if (!$mayTypePayment) {
                unset($data['paid_amount']);
            }

            $data['grand_total'] = $data['grand_total'] ?? $this->calculateGrandTotal($items);

            if (!array_key_exists('paid_amount', $data) || $data['paid_amount'] === null) {
                $defaults = HospitalSetting::where('hospital_id', $data['hospital_id'] ?? null)
                    ->value('default_payment_statuses');
                $defaults = is_string($defaults) ? json_decode($defaults, true) : $defaults;
                $startsPaid = is_array($defaults)
                    && ($defaults[$data['trx_type'] ?? ''] ?? 'pending') === 'paid';

                $data['paid_amount'] = ($startsPaid && $maySettleByDefault)
                    ? (float) $data['grand_total']
                    : 0;
            }


            $data['due_amount'] = $data['due_amount'] ?? max(0, (float) $data['grand_total'] - (float) $data['paid_amount']);

            $transaction = Transaction::create($data);

            // Derive status from the amounts rather than leaving the column at
            // its default: an invoice created fully paid was being stored as
            // pending, so the list showed money received against an outstanding
            // document.
            $transaction->syncPaymentState();
            if ((string) $transaction->payment_status === 'paid') {
                $transaction->last_payment_at = $transaction->last_payment_at ?? now();
                $transaction->settled_by = $transaction->settled_by ?? ($request->user()->name ?? null);
            }
            $transaction->save();

            foreach ($items as $item) {
                $this->ensureHospitalConsistency($transaction->hospital_id, (int) $item['medicine_id']);

                $normalized = $this->normalizeItem($item);
                $transaction->details()->create($normalized);

                $this->applyStockChange(
                    (int) $transaction->hospital_id,
                    $normalized,
                    $transaction->trx_type,
                    false,
                    (int) $transaction->id,
                    $request->user()->name ?? null
                );
            }

            $transaction->load(['details.medicine', 'supplier', 'patient', 'walkInPatient']);
            $this->ledgerPostingService->upsertTransactionSnapshot($transaction);

            return $transaction;
        });

        return response()->json($transaction, 201);
    }

    public function show(Request $request, Transaction $transaction)
    {
        $this->authorizeScope($request->user(), $transaction);

        return response()->json($transaction->load(['details.medicine', 'supplier', 'patient', 'walkInPatient']));
    }

    public function update(Request $request, Transaction $transaction)
    {
        $this->authorizeTransactionAction($request->user(), 'edit_transactions');
        $this->authorizeScope($request->user(), $transaction);

        $data = $this->validatePayload($request, $transaction->hospital_id, true, $transaction->trx_type);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $transaction->hospital_id;
        }

        $this->resolveWalkInCustomer($data, (int) $data['hospital_id'], $request->user()->name ?? null);
        $this->ensurePartyConsistency($data);
        $this->fillPartyNames($data);

        $actor = $request->user()->name ?? null;

        $transaction = DB::transaction(function () use ($data, $transaction, $request, $actor) {
            // Load the old lines before converting the submitted units. When an
            // existing pack/strip line is edited after the medicine's packaging
            // configuration changed, conversion must use the line's stored
            // snapshot or the edit will silently add/remove the wrong pieces.
            $transaction->load('details');
            $items = $this->withSaleUnits($data['items'] ?? [], $transaction);
            unset($data['items']);

            $data['updated_by'] = $data['updated_by'] ?? ($request->user()->name ?? null);

            $data['total_discount'] = $data['total_discount'] ?? $transaction->total_discount;
            $data['total_tax'] = $data['total_tax'] ?? $transaction->total_tax;
            if (!array_key_exists('paid_amount', $data) || $data['paid_amount'] === null) {
                $data['paid_amount'] = $transaction->paid_amount;
            }

            // A pharmacist may edit the stock/invoice lines, but may not alter
            // the cash record. The disabled input in the UI is only a usability
            // guard; enforce the same rule server-side and keep the existing
            // payment amount while the new total recalculates the due balance.
            $mayTypePayment = $request->user()?->hasAnyPermission([
                'record_finance_payments',
                'manage_finance',
            ]) ?? false;
            if (!$mayTypePayment) {
                $data['paid_amount'] = $transaction->paid_amount;
                unset($data['due_amount']);
            }

            $data['grand_total'] = $data['grand_total'] ?? $this->calculateGrandTotal($items);
            $data['due_amount'] = $data['due_amount'] ?? max(0, (float) $data['grand_total'] - (float) $data['paid_amount']);

            $previousDetails = $transaction->details->map(function ($detail) {
                return [
                    'medicine_id' => $detail->medicine_id,
                    'batch_no' => $detail->batch_no,
                    'qtty' => $detail->qtty,
                    'bonus' => $detail->bonus,
                    // Stock moves in PIECES, so a reversal has to give back the
                    // same base quantity that was taken. Omitting these made
                    // applyStockChange fall back to the pack count -- a 10-pack
                    // line of 60 added 600 pieces but only ever removed 10,
                    // leaving 590 phantom pieces behind on every edit.
                    'base_qtty' => $detail->base_qtty,
                    'base_bonus' => $detail->base_bonus,
                    'price' => $detail->price,
                    'expiry_date' => $detail->expiry_date,
                ];
            })->values()->all();

            $nextTrxType = (string) ($data['trx_type'] ?? $transaction->trx_type);
            $isPurchaseToPurchaseEdit = $transaction->trx_type === 'purchase' && $nextTrxType === 'purchase';

            if (!$isPurchaseToPurchaseEdit) {
                foreach ($previousDetails as $previous) {
                    $this->applyStockChange(
                        (int) $transaction->hospital_id,
                        $previous,
                        $transaction->trx_type,
                        true,
                        (int) $transaction->id,
                        $actor
                    );
                }

                $this->ensureStockAvailable(
                    (int) $transaction->hospital_id,
                    $nextTrxType,
                    $items,
                    true
                );
            }

            $transaction->details()->delete();
            $transaction->update($data);

            // Derive the status from the amounts, exactly as store() does.
            //
            // Without this an edit could leave the two disagreeing: typing the
            // full amount into Paid set paid_amount and due_amount but left
            // payment_status at 'pending', so the finance list showed a document
            // marked PENDING with its money already under Paid and nothing in
            // Due -- and the outstanding total at the top, which sums due_amount,
            // correctly ignored it. The badge was the part that was wrong.
            $transaction->syncPaymentState();
            if ((string) $transaction->payment_status === 'paid') {
                $transaction->last_payment_at = $transaction->last_payment_at ?? now();
                $transaction->settled_by = $transaction->settled_by ?? ($request->user()->name ?? null);
            } elseif ((float) $transaction->paid_amount <= 0) {
                // Fully unpaid again: the collector goes with the money.
                $transaction->last_payment_at = null;
                $transaction->settled_by = null;
            }
            $transaction->save();

            foreach ($items as $item) {
                $this->ensureHospitalConsistency($transaction->hospital_id, (int) $item['medicine_id']);

                $normalized = $this->normalizeItem($item);
                $transaction->details()->create($normalized);

                $this->applyStockChange(
                    (int) $transaction->hospital_id,
                    $normalized,
                    $transaction->trx_type,
                    false,
                    (int) $transaction->id,
                    $actor
                );
            }

            if ($isPurchaseToPurchaseEdit) {
                foreach ($previousDetails as $previous) {
                    $this->applyStockChange(
                        (int) $transaction->hospital_id,
                        $previous,
                        'purchase',
                        true,
                        (int) $transaction->id,
                        $actor
                    );
                }
            }

            $transaction->load(['details.medicine', 'supplier', 'patient', 'walkInPatient']);
            $this->ledgerPostingService->upsertTransactionSnapshot($transaction);

            return $transaction;
        });

        return response()->json($transaction);
    }

    public function destroy(Request $request, Transaction $transaction)
    {
        $this->authorizeTransactionAction($request->user(), 'delete_transactions');
        $this->authorizeScope($request->user(), $transaction);

        $actor = $request->user()->name ?? null;

        DB::transaction(function () use ($transaction, $actor) {
            $transaction->load('details');

            foreach ($transaction->details as $detail) {
                $this->applyStockChange(
                    (int) $transaction->hospital_id,
                    [
                        'medicine_id' => $detail->medicine_id,
                        'batch_no' => $detail->batch_no,
                        'qtty' => $detail->qtty,
                        'bonus' => $detail->bonus,
                        // Same reason as in update(): give back base pieces, not packs.
                        'base_qtty' => $detail->base_qtty,
                        'base_bonus' => $detail->base_bonus,
                        'price' => $detail->price,
                        'expiry_date' => $detail->expiry_date,
                    ],
                    $transaction->trx_type,
                    true,
                    (int) $transaction->id,
                    $actor
                );
            }

            $transaction->delete();
            $this->ledgerPostingService->voidTransactionSnapshot($transaction, $actor);
        });

        return response()->json(['message' => 'Transaction deleted']);
    }

    private function validatePayload(Request $request, ?int $defaultHospitalId = null, bool $isUpdate = false, ?string $defaultTrxType = null): array
    {
        $hospitalId = $request->integer('hospital_id') ?: $defaultHospitalId ?: $request->user()->hospital_id;
        $trxType = $request->input('trx_type') ?? $defaultTrxType;

        return $request->validate([
            'hospital_id' => [$request->user()->role === 'super_admin' ? 'required' : 'sometimes', 'exists:hospitals,id'],
            'trx_type' => [$isUpdate ? 'sometimes' : 'required', 'in:purchase,sales,purchase_return,sales_return'],
            'supplier_id' => [
                Rule::requiredIf(fn () => in_array($request->input('trx_type'), ['purchase', 'purchase_return'], true)),
                'nullable',
                'exists:suppliers,id',
            ],
            // A sale needs a party, but that party may be a registered hospital
            // patient OR a walk-in customer (retail pharmacy). patient_id is only
            // required when the sale is NOT flagged as walk-in.
            'patient_id' => [
                Rule::requiredIf(fn () => in_array($request->input('trx_type'), ['sales', 'sales_return'], true)
                    && !$request->boolean('is_walk_in')),
                'nullable',
                'exists:patients,id',
            ],
            'is_walk_in' => ['nullable', 'boolean'],
            'walk_in_patient_id' => ['nullable', 'exists:walk_in_patients,id'],
            // Free-text details for a walk-in customer. Only the name is required,
            // and only when a walk-in sale is not reusing an existing walk-in record.
            'walk_in_customer.name' => [
                Rule::requiredIf(fn () => $request->boolean('is_walk_in')
                    && in_array($request->input('trx_type'), ['sales', 'sales_return'], true)
                    && !$request->filled('walk_in_patient_id')),
                'nullable', 'string', 'max:255',
            ],
            'walk_in_customer.phone' => ['nullable', 'string', 'max:30'],
            'walk_in_customer.address' => ['nullable', 'string', 'max:255'],
            'walk_in_customer.age' => ['nullable', 'integer', 'min:0', 'max:150'],
            'walk_in_customer.gender' => ['nullable', 'in:male,female,other'],
            'grand_total' => ['nullable', 'numeric', 'min:0'],
            'total_discount' => ['nullable', 'numeric', 'min:0'],
            'total_tax' => ['nullable', 'numeric', 'min:0'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'due_amount' => ['nullable', 'numeric', 'min:0'],
            'created_by' => ['nullable', 'string', 'max:255'],
            'updated_by' => ['nullable', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.id' => ['sometimes', 'integer', 'exists:transaction_details,id'],
            'items.*.medicine_id' => ['required', 'exists:medicines,id'],
            'items.*.batch_no' => ['nullable', 'string', 'max:255'],
            'items.*.expiry_date' => ['nullable', 'date'],
            'items.*.qtty' => ['required', 'integer', 'min:1'],
            'items.*.sale_unit' => ['nullable', 'in:piece,strip,pack'],
            'items.*.bonus' => ['nullable', 'integer', 'min:0'],
            'items.*.price' => ['required', 'numeric', 'min:0'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.tax' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);
    }

    /**
     * Augment each line with its base (piece) quantities.
     *
     * Inventory -- stocks, medicines.stock, stock_movements -- is always held in
     * pieces. Quantities are converted once here so the rest of the pipeline is
     * untouched, and the pack size is snapshotted onto the line so that editing a
     * medicine's pack size later never rewrites past invoices.
     */
    private function withSaleUnits(array $items, ?Transaction $existingTransaction = null): array
    {
        $medicineIds = array_values(array_unique(array_filter(array_map(
            fn ($item) => (int) ($item['medicine_id'] ?? 0),
            $items
        ))));

        // Both tiers are needed: a strip line converts by pieces_per_strip, a pack
        // line by the full pack_size.
        $packaging = Medicine::query()
            ->whereIn('id', $medicineIds)
            ->get(['id', 'brand_name', 'pack_size', 'pieces_per_strip', 'sellable_units'])
            ->keyBy('id');

        $existingDetails = $existingTransaction?->details
            ?->keyBy('id') ?? collect();

        return array_map(function (array $item, int $index) use ($packaging, $existingDetails) {
            $medicineId = (int) ($item['medicine_id'] ?? 0);
            $saleUnit = (string) ($item['sale_unit'] ?? 'piece');

            // Falling back to piece here is never safe: an unrecognised unit would
            // reserve 1 piece for what the till charged as a full pack, quietly
            // draining stock. Refuse the line instead.
            if (!in_array($saleUnit, ['piece', 'strip', 'pack'], true)) {
                throw ValidationException::withMessages([
                    "items.$index.sale_unit" => "Unknown sale unit \"$saleUnit\". Expected piece, strip or pack.",
                ]);
            }

            $medicine = $packaging->get($medicineId);

            // The unit must be one the product is actually sold in. Accepting
            // 'piece' for a product sold only by the box stocked one tablet for
            // a carton of two hundred -- the line looked settled and the shelf
            // never matched. Refused rather than silently corrected: only the
            // person entering it knows whether they meant 10 boxes or 10 strips.
            $sellable = $medicine?->sellable_units;
            if (is_array($sellable) && $sellable !== [] && !in_array($saleUnit, $sellable, true)) {
                throw ValidationException::withMessages([
                    "items.$index.sale_unit" => sprintf(
                        '%s is not sold by %s. Choose one of: %s.',
                        $medicine->brand_name ?? 'This medicine',
                        $saleUnit,
                        implode(', ', $sellable)
                    ),
                ]);
            }

            $packSize = max(1, (int) ($medicine->pack_size ?? 1));
            $perStrip = max(1, (int) ($medicine->pieces_per_strip ?? 1));

            // A piece line always converts 1:1, whatever the packaging is.
            $factor = match ($saleUnit) {
                'pack' => $packSize,
                'strip' => $perStrip,
                default => 1,
            };

            // A line id is only meaningful during an update. Trust the
            // server-side snapshot, never a client-supplied quantity, and only
            // when the medicine and sale tier are unchanged. New lines or lines
            // whose tier/product changed use today's configuration.
            $existing = !empty($item['id']) ? $existingDetails->get((int) $item['id']) : null;
            if ($existing
                && (int) $existing->medicine_id === $medicineId
                && (string) ($existing->sale_unit ?: 'piece') === $saleUnit
            ) {
                $factor = max(1, (int) ($existing->pack_size_snapshot ?? $factor));
            }

            $item['sale_unit'] = $saleUnit;
            // Snapshot the pieces-per-unit actually used, so later packaging edits
            // never rewrite the history of this line.
            $item['pack_size_snapshot'] = $factor;
            $item['base_qtty'] = (int) ($item['qtty'] ?? 0) * $factor;
            $item['base_bonus'] = (int) ($item['bonus'] ?? 0) * $factor;

            return $item;
        }, $items, array_keys($items));
    }

    private function ensureStockAvailable(int $hospitalId, string $trxType, array $items, bool $lockRows = false): void
    {
        if (!in_array($trxType, ['sales', 'purchase_return'], true)) {
            return;
        }

        $requiredByKey = [];
        foreach ($items as $item) {
            $medicineId = (int) ($item['medicine_id'] ?? 0);
            if (!$medicineId) {
                continue;
            }
            $batchNo = $item['batch_no'] ?? null;
            // Base (piece) quantities: a pack line reserves pack_size pieces.
            $required = (int) ($item['base_qtty'] ?? $item['qtty'] ?? 0)
                + (int) ($item['base_bonus'] ?? $item['bonus'] ?? 0);
            if ($required <= 0) {
                continue;
            }

            $key = $medicineId . '::' . ($batchNo ?? '__all__');
            $requiredByKey[$key] = ($requiredByKey[$key] ?? 0) + $required;
        }

        foreach ($requiredByKey as $key => $required) {
            [$medicineIdRaw, $batchNo] = explode('::', $key, 2);
            $medicineId = (int) $medicineIdRaw;

            $query = Stock::query()
                ->where('hospital_id', $hospitalId)
                ->where('medicine_id', $medicineId);

            if ($batchNo !== '__all__') {
                $query->where('batch_no', $batchNo);
            }

            if ($trxType === 'sales') {
                $today = now()->toDateString();
                $query->where(function ($q) use ($today) {
                    $q->whereNull('expiry_date')
                        ->orWhere('expiry_date', '>=', $today);
                });
            }

            if ($lockRows) {
                $stocks = $query->lockForUpdate()->get(['stock_qty', 'bonus_qty']);
                $available = (int) $stocks->reduce(function (int $sum, Stock $stock) {
                    return $sum + (int) $stock->stock_qty + (int) ($stock->bonus_qty ?? 0);
                }, 0);
            } else {
                $available = (int) $query->sum(DB::raw('stock_qty + COALESCE(bonus_qty, 0)'));
            }

            if ($available < $required) {
                $medicine = Medicine::find($medicineId);
                $name = $medicine?->brand_name ?? 'Medicine';
                $batchLabel = $batchNo !== '__all__' ? " (Batch: {$batchNo})" : '';

                // A batch the product has never carried reads as "out of stock"
                // even when the shelf is full, which sent the counter hunting
                // for a phantom shortage. Say so explicitly: the fix is to pick
                // the batch again, not to reorder the product.
                $hint = '';
                if ($batchNo !== '__all__' && $available === 0) {
                    $acrossAllBatches = (int) Stock::query()
                        ->where('hospital_id', $hospitalId)
                        ->where('medicine_id', $medicineId)
                        ->sum(DB::raw('stock_qty + COALESCE(bonus_qty, 0)'));

                    if ($acrossAllBatches >= $required) {
                        $hint = " This product has {$acrossAllBatches} in stock under other batches"
                            . " -- batch \"{$batchNo}\" does not belong to it. Re-select the batch on that line.";
                    }
                }

                throw ValidationException::withMessages([
                    'items' => "Insufficient stock for {$name}{$batchLabel}. Available: {$available}, Required: {$required}.{$hint}",
                ]);
            }
        }
    }

    private function normalizeItem(array $item): array
    {
        $qtty = (int) ($item['qtty'] ?? 0);
        $price = (float) ($item['price'] ?? 0);
        $discount = (float) ($item['discount'] ?? 0);
        $tax = (float) ($item['tax'] ?? 0);

        $unitDiscount = ($price * $discount) / 100;
        $unitTax = ($price * $tax) / 100;
        $amount = $qtty * ($price - $unitDiscount + $unitTax);

        return [
            'medicine_id' => $item['medicine_id'],
            'batch_no' => $item['batch_no'] ?? null,
            'expiry_date' => $item['expiry_date'] ?? null,
            'qtty' => $qtty,
            'bonus' => (int) ($item['bonus'] ?? 0),
            'sale_unit' => in_array(($item['sale_unit'] ?? 'piece'), ['piece', 'strip', 'pack'], true) ? $item['sale_unit'] : 'piece',
            'pack_size_snapshot' => max(1, (int) ($item['pack_size_snapshot'] ?? 1)),
            'base_qtty' => (int) ($item['base_qtty'] ?? $qtty),
            'base_bonus' => (int) ($item['base_bonus'] ?? ($item['bonus'] ?? 0)),
            'price' => $price,
            'discount' => $discount,
            'tax' => $tax,
            'amount' => round($amount, 2),
        ];
    }

    private function calculateGrandTotal(array $items): float
    {
        $total = 0;
        foreach ($items as $item) {
            $normalized = $this->normalizeItem($item);
            $total += (float) $normalized['amount'];
        }

        return round($total, 2);
    }

    private function ensureHospitalConsistency(int $hospitalId, int $medicineId): void
    {
        $medicine = Medicine::findOrFail($medicineId);

        if ((int) $medicine->hospital_id !== (int) $hospitalId) {
            abort(422, 'Medicine does not belong to the selected hospital');
        }
    }

    private function ensurePartyConsistency(array $data): void
    {
        $hospitalId = (int) ($data['hospital_id'] ?? 0);

        if (!empty($data['supplier_id'])) {
            $supplier = Supplier::findOrFail((int) $data['supplier_id']);
            if ((int) $supplier->hospital_id !== $hospitalId) {
                abort(422, 'Supplier does not belong to the selected hospital');
            }
        }

        if (!empty($data['patient_id'])) {
            $patient = Patient::findOrFail((int) $data['patient_id']);
            if ((int) $patient->hospital_id !== $hospitalId) {
                abort(422, 'Patient does not belong to the selected hospital');
            }
        }
    }

    private function fillPartyNames(array &$data): void
    {
        $data['supplier_name'] = null;
        $data['patient_name'] = null;

        if (!empty($data['supplier_id'])) {
            $supplier = Supplier::find((int) $data['supplier_id']);
            $data['supplier_name'] = $supplier?->name;
        }

        if (!empty($data['patient_id'])) {
            $patient = Patient::find((int) $data['patient_id']);
            $data['patient_name'] = $patient?->name;
        }

        // Walk-in sale: the customer name is snapshot onto the transaction the same
        // way a registered patient's name is, so receipts and lists render
        // identically for both kinds of sale.
        if (!empty($data['walk_in_patient_id'])) {
            $walkIn = WalkInPatient::find((int) $data['walk_in_patient_id']);
            $data['patient_name'] = $walkIn?->name;
        }
    }

    /**
     * Turn the free-text walk-in customer details into a WalkInPatient record and
     * put its id on the transaction. Reuses the model already shared by
     * prescriptions and lab orders rather than introducing a pharmacy-only customer.
     */
    private function resolveWalkInCustomer(array &$data, int $hospitalId, ?string $actor): void
    {
        $isWalkIn = (bool) ($data['is_walk_in'] ?? false);
        $customer = $data['walk_in_customer'] ?? null;
        unset($data['walk_in_customer']);

        if (!$isWalkIn) {
            $data['is_walk_in'] = false;
            $data['walk_in_patient_id'] = null;
            return;
        }

        // A walk-in sale never carries a registered patient.
        $data['is_walk_in'] = true;
        $data['patient_id'] = null;

        if (!empty($data['walk_in_patient_id'])) {
            $existing = WalkInPatient::find((int) $data['walk_in_patient_id']);
            if (!$existing || (int) $existing->hospital_id !== $hospitalId) {
                abort(422, 'Walk-in customer does not belong to the selected hospital');
            }
            return;
        }

        $walkIn = WalkInPatient::create([
            'hospital_id' => $hospitalId,
            'name' => trim((string) ($customer['name'] ?? '')) ?: 'Walk-in Customer',
            'age' => (int) ($customer['age'] ?? 0),
            'gender' => $customer['gender'] ?? null,
            'phone' => $customer['phone'] ?? null,
            'address' => $customer['address'] ?? null,
            'created_by' => $actor,
        ]);

        $data['walk_in_patient_id'] = $walkIn->id;
    }

    private function applyStockChange(int $hospitalId, array $item, string $trxType, bool $reverse = false, ?int $trxId = null, ?string $actor = null): void
    {
        $medicineId = (int) ($item['medicine_id'] ?? 0);
        // Always move base pieces through inventory, never pack counts.
        $qtty = (int) ($item['base_qtty'] ?? $item['qtty'] ?? 0);
        $bonus = (int) ($item['base_bonus'] ?? $item['bonus'] ?? 0);
        $price = (float) ($item['price'] ?? 0);
        $expiryDate = $item['expiry_date'] ?? null;

        $qtyDelta = match ($trxType) {
            'purchase' => $qtty,
            'purchase_return' => -1 * $qtty,
            'sales' => -1 * $qtty,
            'sales_return' => $qtty,
            default => 0,
        };
        $bonusDelta = match ($trxType) {
            'purchase' => $bonus,
            'purchase_return' => -1 * $bonus,
            'sales' => -1 * $bonus,
            'sales_return' => $bonus,
            default => 0,
        };
        if ($reverse) {
            $qtyDelta *= -1;
            $bonusDelta *= -1;
        }

        $batchNo = $item['batch_no'] ?? null;
        $stock = Stock::query()
            ->where('hospital_id', $hospitalId)
            ->where('medicine_id', $medicineId)
            ->where('batch_no', $batchNo)
            ->lockForUpdate()
            ->first();

        if (!$stock) {
            $stock = new Stock([
                'hospital_id' => $hospitalId,
                'medicine_id' => $medicineId,
                'batch_no' => $batchNo,
                'stock_qty' => 0,
                'bonus_qty' => 0,
            ]);
        }

        // A reversal only gives quantity back -- it must never restate the batch's
        // expiry or price. Editing a purchase applies the new lines first and
        // reverses the old ones after, so a reversal that wrote metadata stamped
        // the *superseded* expiry back over the corrected one and the batch stayed
        // expired however many times it was fixed on screen.
        if (!$reverse) {
            if ($expiryDate && (!$stock->expiry_date || (string) $stock->expiry_date !== (string) $expiryDate)) {
                $stock->expiry_date = $expiryDate;
            }
            if (in_array($trxType, ['purchase', 'purchase_return'], true) && $price > 0) {
                $stock->purchase_price = $price;
            }
            if (in_array($trxType, ['sales', 'sales_return'], true) && $price > 0) {
                $stock->sale_price = $price;
            }
        }

        $nextStockQty = ((int) $stock->stock_qty) + $qtyDelta;
        $nextBonusQty = ((int) ($stock->bonus_qty ?? 0)) + $bonusDelta;

        if ($nextStockQty < 0 || $nextBonusQty < 0) {
            $medicine = Medicine::find($medicineId);
            $name = $medicine?->brand_name ?? 'Medicine';
            $batchLabel = $batchNo ? " (Batch: {$batchNo})" : '';

            throw ValidationException::withMessages([
                'items' => "Insufficient stock for {$name}{$batchLabel} during stock update.",
            ]);
        }

        $stock->stock_qty = $nextStockQty;
        $stock->bonus_qty = $nextBonusQty;
        $stock->save();

        $medicine = Medicine::query()->whereKey($medicineId)->lockForUpdate()->first();
        if ($medicine) {
            $nextMedicineStock = ((int) $medicine->stock) + ($qtyDelta + $bonusDelta);
            if ($nextMedicineStock < 0) {
                throw ValidationException::withMessages([
                    'items' => "Insufficient aggregate stock for {$medicine->brand_name} during stock update.",
                ]);
            }

            $medicine->stock = $nextMedicineStock;
            $medicine->save();
        }

        StockMovement::create([
            'hospital_id' => $hospitalId,
            'medicine_id' => $medicineId,
            'trx_id' => $trxId,
            'trx_type' => $trxType,
            'batch_no' => $batchNo,
            'expiry_date' => $expiryDate ?: $stock->expiry_date,
            'qty_change' => $qtyDelta,
            'bonus_change' => $bonusDelta,
            'unit_price' => $price,
            'balance_qty' => (int) $stock->stock_qty,
            'balance_bonus' => (int) ($stock->bonus_qty ?? 0),
            'actor' => $actor,
            'is_reversal' => $reverse,
        ]);
    }

    private function authorizeTransactionAction($user, string $permission): void
    {
        $this->ensureAnyPermission(
            $user,
            [$permission, 'manage_transactions'],
            'Only users with transaction permissions can manage transactions'
        );
    }

    private function authorizeScope($user, Transaction $transaction): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $transaction->hospital_id) {
            abort(403, 'Unauthorized transaction access');
        }
    }
}
