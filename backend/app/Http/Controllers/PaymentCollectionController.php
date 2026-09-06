<?php

namespace App\Http\Controllers;

use App\Models\LedgerEntry;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * The money collector's desk: every unpaid charge in the hospital, in one list.
 *
 * A cashier does not know which module a charge came from. A patient hands over
 * a slip or just says their name, and may owe for a consultation AND a lab test
 * at the same moment. Making the collector pick a module first -- then a
 * submenu, then a page -- is the queue-length problem the counter actually has.
 *
 * Everything here is read from ledger_entries, which already carries all six
 * revenue modules in one shape. Settling still goes to the module's own payment
 * endpoint, so each collection keeps its own permission check and records its
 * own collector; this controller only finds the work.
 */
class PaymentCollectionController extends Controller
{
    /**
     * Ledger module => [permission that reveals it, source_type, label].
     *
     * A module appears only when the user may actually take money for it, so a
     * pharmacy-only cashier sees pharmacy invoices and nothing else. The same
     * rule the day-end handover uses: one permission, both purposes, rather than
     * a parallel set that can drift.
     */
    private const MODULES = [
        'appointments' => ['manage_appointment_payments', 'appointment', 'Appointments', 'reverse_appointment_payment'],
        'laboratory' => ['manage_lab_payments', 'lab_order', 'Lab Orders', 'reverse_lab_payment'],
        'radiology' => ['manage_ultrasound_payments', 'ultrasound_exam', 'Ultrasound', 'reverse_ultrasound_payment'],
        // X-Ray is its own module rather than a second entry under radiology:
        // this map is keyed by module, so two radiology source types could not
        // both be reached from here.
        'xray' => ['manage_xray_payments', 'xray_receipt', 'X-Ray', 'reverse_xray_payment'],
        'dental' => ['manage_dental_payments', 'dental_receipt', 'Dental', 'reverse_dental_payment'],
        'surgery' => ['manage_surgery_payments', 'patient_surgery', 'Surgery', 'reverse_surgery_payment'],
        'room_booking' => ['manage_room_booking_payments', 'room_booking', 'Room Bookings', 'reverse_room_booking_payment'],
        'pharmacy' => ['record_finance_payments', 'transaction', 'Pharmacy Invoices', 'reverse_finance_payment'],
    ];

    /**
     * The pharmacy document types: label, family, and sign within that family.
     *
     * Returns carry -1 so they are deducted from the family they belong to --
     * Return In comes off sales, Return Out comes off purchases. The families
     * are never combined: they are settled by different people at different
     * counters, and a net of the two is not money anyone handles.
     */
    private const PHARMACY_TYPES = [
        'sales' => ['Sales Invoices', 'sales', 1],
        'sales_return' => ['Return In (Sales Return)', 'sales', -1],
        'purchase' => ['Purchase Invoices', 'purchase', 1],
        'purchase_return' => ['Return Out (Purchase Return)', 'purchase', -1],
    ];

    /** source_type => table the document lives in, for the existence check. */
    private const SOURCE_TABLES = [
        'appointment' => 'appointments',
        'lab_order' => 'lab_orders',
        'ultrasound_exam' => 'ultrasound_exams',
        'xray_receipt' => 'xray_receipts',
        'dental_receipt' => 'dental_receipts',
        'patient_surgery' => 'patient_surgeries',
        'room_booking' => 'room_bookings',
        'transaction' => 'transactions',
    ];

    public function pending(Request $request)
    {
        $user = $request->user();

        $hospitalId = $user && $user->role === 'super_admin'
            ? ($request->integer('hospital_id') ?: $user->hospital_id)
            : $user?->hospital_id;

        if (!$hospitalId && (!$user || $user->role !== 'super_admin')) {
            return response()->json(['message' => 'Hospital is required'], 422);
        }

        $allowed = $this->allowedModules($user);

        if (empty($allowed)) {
            return response()->json([
                'data' => [],
                'modules' => [],
                'summary' => ['due_total' => 0, 'entries' => 0, 'collected_today' => 0],
            ]);
        }

        // A module the caller cannot collect for is never queried, let alone
        // returned -- the filter is not something the client can widen.
        $requested = (string) $request->query('module', '');
        $modules = ($requested !== '' && array_key_exists($requested, $allowed))
            ? [$requested]
            : array_keys($allowed);

        // Settled charges are listed too, not only outstanding ones: the desk
        // needs to look up a receipt it has just taken, and confirm a payment
        // landed. They sort below the pending work by default so the queue is
        // still the first thing on screen.
        $query = LedgerEntry::query()
            ->leftJoin('patients', 'patients.id', '=', 'ledger_entries.patient_id')
            ->when($hospitalId, fn ($q) => $q->where('ledger_entries.hospital_id', $hospitalId))
            ->whereNull('ledger_entries.voided_at')
            ->where('ledger_entries.entry_direction', 'income')
            ->whereIn('ledger_entries.module', $modules);

        $this->joinWalkInCustomers($query);

        $query->select([
            'ledger_entries.*',
            // A walk-in owes money exactly as a registered patient does, but
            // carries no patients row -- so the plain join left the whole
            // identity blank and the cashier saw three dashes and a reference
            // number. Retail pharmacy sales are most of the queue, which made
            // the list unusable for the desk it was built for.
            DB::raw('COALESCE(patients.name, wi_txn.name, wi_lab.name, txn.patient_name, lo.patient_name) as patient_name'),
            DB::raw('COALESCE(patients.phone, wi_txn.phone, wi_lab.phone) as patient_phone'),
            DB::raw('patients.patient_id as patient_code'),
            // Walk-ins are numbered in their own series, so the serial is shown
            // as its own field rather than pushed into patient_code, where it
            // would read as a patient number that does not exist.
            DB::raw('COALESCE(wi_txn.serial_no, wi_lab.serial_no) as walk_in_serial'),
            // The one timestamp the range, the sort and the Date column all
            // agree on. Showing posted_at while filtering on collected_at made
            // a charge raised last week and settled today appear inside today's
            // window with last week's date beside it.
            DB::raw('COALESCE(ledger_entries.collected_at, ledger_entries.posted_at) as effective_at'),
        ]);

        // Never offer a charge whose document has since been deleted. The ledger
        // is a mirror, and a stale row here is not a harmless display glitch: it
        // inflates the outstanding total and the collect button dies with "No
        // query results for model". Root causes are fixed and history has been
        // reconciled, but the desk should not depend on that staying true.
        $query->where(function ($outer) use ($modules) {
            foreach ($modules as $index => $module) {
                [, $sourceType] = self::MODULES[$module];
                $table = self::SOURCE_TABLES[$sourceType] ?? null;

                $clause = function ($inner) use ($sourceType, $table) {
                    $inner->where('ledger_entries.source_type', $sourceType);
                    if ($table) {
                        $inner->whereExists(fn ($exists) => $exists
                            ->select(DB::raw(1))
                            ->from($table)
                            ->whereColumn($table . '.id', 'ledger_entries.source_id'));
                    }
                };

                $index === 0 ? $outer->where($clause) : $outer->orWhere($clause);
            }
        });

        $status = (string) $request->query('status', 'all');
        if ($status === 'pending') {
            $query->where('ledger_entries.due_amount', '>', 0);
        } elseif ($status === 'paid') {
            $query->where('ledger_entries.due_amount', '<=', 0);
        }

        if ($search = trim((string) $request->query('search', ''))) {
            $like = '%' . $search . '%';
            // Walk-ins are searched on the same terms as patients. Displaying
            // their name without making it findable would still leave the desk
            // scrolling for a customer standing in front of them.
            $query->where(function ($q) use ($like) {
                $q->where('ledger_entries.title', 'like', $like)
                    ->orWhere('patients.name', 'like', $like)
                    ->orWhere('patients.patient_id', 'like', $like)
                    ->orWhere('patients.phone', 'like', $like)
                    ->orWhere('wi_txn.name', 'like', $like)
                    ->orWhere('wi_txn.phone', 'like', $like)
                    ->orWhere('wi_txn.serial_no', 'like', $like)
                    ->orWhere('wi_lab.name', 'like', $like)
                    ->orWhere('wi_lab.phone', 'like', $like)
                    ->orWhere('wi_lab.serial_no', 'like', $like)
                    ->orWhere('txn.patient_name', 'like', $like)
                    ->orWhere('lo.patient_name', 'like', $like);
            });
        }

        // The date range is applied last so it narrows everything above it, and
        // the same window is handed to the summary figures below -- otherwise
        // the header would report one period while the list showed another.
        [$from, $to] = $this->resolveRange($request);
        $this->applyRange($query, $from, $to);

        $this->applySorting($query, $request);

        // The page is taken from this request rather than left to the paginator's
        // global request resolution, so the endpoint behaves the same however it
        // is called.
        $entries = $query->paginate(
            max(1, min($request->integer('per_page', 50), 200)),
            ['*'],
            'page',
            max(1, $request->integer('page', 1))
        );

        $moduleTotals = $this->moduleCounts($hospitalId, $allowed, $from, $to);
        $reversible = $this->reversibleModules($user);

        $entries->getCollection()->transform(function (LedgerEntry $entry) use ($reversible) {
            [, $sourceType, $label] = self::MODULES[$entry->module] ?? [null, $entry->module, $entry->module, null];
            $due = round((float) $entry->due_amount, 2);

            return [
                'id' => $entry->id,
                'module' => $entry->module,
                'module_label' => $label,
                'source_type' => $sourceType,
                'source_id' => $entry->source_id,
                'reference' => $entry->title,
                'title' => $entry->title,
                'patient_id' => $entry->patient_id,
                'patient_name' => $entry->patient_name,
                // Falls back to the walk-in series so the column is never blank
                // for a customer who genuinely has no hospital number.
                'patient_code' => $entry->patient_code
                    ?: ($entry->walk_in_serial ? 'W-' . $entry->walk_in_serial : null),
                'patient_phone' => $entry->patient_phone,
                'is_walk_in' => $entry->patient_id === null && $entry->walk_in_serial !== null,
                'net_amount' => round((float) $entry->net_amount, 2),
                'paid_amount' => round((float) $entry->paid_amount, 2),
                'due_amount' => $due,
                'currency' => $entry->currency,
                // Derived from what is still owed rather than from the source
                // document's own wording: six modules spell their statuses
                // differently ('unpaid', 'pending', 'partial'), and the collector
                // only needs to know whether money is still due.
                'payment_status' => $due > 0 ? 'pending' : 'paid',
                'status' => $entry->status,
                'posted_at' => $entry->posted_at,
                'collected_at' => $entry->collected_at,
                // What the Date column shows: when the charge was settled, or
                // when it was raised if it has not been.
                'effective_at' => $entry->effective_at,
                // Lab and pharmacy accept part payment; the rest are settled in
                // full, so the till shows an amount box only where it means
                // something.
                'supports_partial' => in_array($entry->module, ['laboratory', 'pharmacy'], true),
                // Undoing a collection is a separate right from taking one, so
                // the button is offered per row, per module, and only to someone
                // who actually holds it.
                'can_reverse' => $due <= 0 && in_array($entry->module, $reversible, true),
            ];
        });

        return response()->json([
            'data' => $entries->items(),
            'meta' => [
                'current_page' => $entries->currentPage(),
                'last_page' => $entries->lastPage(),
                'total' => $entries->total(),
            ],
            'modules' => $moduleTotals,
            'grand_total' => $this->grandTotal($moduleTotals),
            // Shown only to a pharmacy collector, because it is their
            // reconciliation sheet: the same four document types, totals and
            // balances the Pharmacy Finance screen reports, so the two can be
            // checked against each other before that screen is retired.
            'pharmacy_breakdown' => array_key_exists('pharmacy', $allowed)
                ? $this->pharmacyBreakdown($hospitalId, $from, $to)
                : null,
            'range' => [
                'from' => $from->format('Y-m-d\TH:i'),
                'to' => $to->format('Y-m-d\TH:i'),
            ],
            // Header figures cover the modules this user may collect for, and
            // are deliberately NOT narrowed by the module chip or the search
            // box -- they are what the drawer is counted against.
            //
            // They ARE narrowed by the date range, because a range the desk has
            // chosen and a total that ignores it cannot both be right on the
            // same screen. `due_total_all` keeps the standing debt visible, so
            // defaulting to today does not hide money owed from last week.
            'summary' => [
                'due_total' => $this->outstandingTotal($hospitalId, array_keys($allowed), $from, $to),
                'due_total_all' => $this->outstandingTotal($hospitalId, array_keys($allowed)),
                'entries' => $entries->total(),
                'collected_in_range' => $this->collectedInRange($hospitalId, $user, array_keys($allowed), $from, $to),
                'collected_today' => $this->collectedToday($hospitalId, $user, array_keys($allowed)),
            ],
        ]);
    }

    /**
     * Sorting, from a fixed set of columns.
     *
     * The column names are mapped rather than passed through, so a sort
     * parameter can never reach the database as raw SQL.
     *
     * Whatever the chosen column, unpaid rows still come first: this is a work
     * queue before it is a report, and sorting by patient name should not bury
     * the outstanding charges among hundreds of settled ones.
     */
    private function applySorting($query, Request $request): void
    {
        $columns = [
            'code' => 'patients.patient_id',
            'name' => 'patients.name',
            'phone' => 'patients.phone',
            'reference' => 'ledger_entries.title',
            'module' => 'ledger_entries.module',
            'amount' => 'ledger_entries.due_amount',
            'date' => 'effective_at',
            'status' => 'ledger_entries.due_amount',
        ];

        $sort = (string) $request->query('sort', 'date');
        $direction = strtolower((string) $request->query('direction', 'desc')) === 'asc' ? 'asc' : 'desc';
        $column = $columns[$sort] ?? $columns['date'];

        // Pending first, unless the user is explicitly sorting BY status, in
        // which case their chosen direction is the whole point.
        if ($sort !== 'status') {
            $query->orderByRaw('CASE WHEN ledger_entries.due_amount > 0 THEN 0 ELSE 1 END');
        }

        $query->orderBy($column, $direction);

        // A stable tiebreak, so paging cannot show the same row twice.
        if ($sort !== 'date') {
            $query->orderByDesc('effective_at');
        }
        $query->orderByDesc('ledger_entries.id');
    }

    /**
     * Bring walk-in customers into reach of the query.
     *
     * Only pharmacy sales and lab orders can be raised for someone who is not a
     * registered patient; the other four modules require a patients row, so
     * their rows simply leave these joins null.
     */
    private function joinWalkInCustomers($query): void
    {
        $query
            ->leftJoin('transactions as txn', function ($join) {
                $join->on('txn.id', '=', 'ledger_entries.source_id')
                    ->where('ledger_entries.source_type', '=', 'transaction');
            })
            ->leftJoin('lab_orders as lo', function ($join) {
                $join->on('lo.id', '=', 'ledger_entries.source_id')
                    ->where('ledger_entries.source_type', '=', 'lab_order');
            })
            ->leftJoin('walk_in_patients as wi_txn', 'wi_txn.id', '=', 'txn.walk_in_patient_id')
            ->leftJoin('walk_in_patients as wi_lab', 'wi_lab.id', '=', 'lo.walk_in_patient_id');
    }

    /**
     * The window the desk is looking at, defaulting to today.
     *
     * Both ends carry a time, because a counter is reconciled per shift as often
     * as per day. A `to` given as a bare date is stretched to the end of that
     * day: read literally it means midnight, which silently excluded every
     * payment taken during the final day of the range.
     */
    private function resolveRange(Request $request): array
    {
        $rawFrom = trim((string) $request->query('from', ''));
        $rawTo = trim((string) $request->query('to', ''));

        try {
            $from = $rawFrom !== '' ? Carbon::parse($rawFrom) : Carbon::today();
        } catch (\Throwable) {
            $from = Carbon::today();
        }

        try {
            $to = $rawTo !== '' ? Carbon::parse($rawTo) : Carbon::today()->endOfDay();
        } catch (\Throwable) {
            $to = Carbon::today()->endOfDay();
        }

        // A date with no time parses to midnight; as an upper bound that is the
        // start of the day the user meant to include, not the end of it.
        if ($rawTo !== '' && !preg_match('/\d:\d/', $rawTo)) {
            $to = $to->endOfDay();
        }

        // Seconds are never entered, so the final minute is included whole --
        // otherwise a payment at 17:00:30 falls outside a range ending 17:00.
        $to = $to->setSecond(59);

        // Reversed input is corrected rather than returning nothing, which just
        // looks like a broken screen.
        if ($to->lt($from)) {
            [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
        }

        return [$from, $to];
    }

    /**
     * Restrict to the window.
     *
     * Keyed on collected_at where the charge has been settled and posted_at
     * where it has not, so one range answers both questions the desk asks: what
     * was taken in this period, and what was raised in it. The same expression
     * the handover total uses.
     */
    private function applyRange($query, Carbon $from, Carbon $to): void
    {
        $query->whereBetween(
            DB::raw('COALESCE(ledger_entries.collected_at, ledger_entries.posted_at)'),
            [$from, $to]
        );
    }

    /**
     * The four pharmacy document types, totalled by family.
     *
     * Deliberately NOT restricted to entry_direction 'income' the way the queue
     * above is. A sales return is posted as an expense -- money handed back --
     * so it never appears in a collection queue and never should. But it is
     * half of what the drawer reconciles to, and leaving it out is what made
     * the collector's total disagree with the Pharmacy Finance screen.
     *
     * Sales and purchases are totalled apart, and a return is subtracted from
     * the family it belongs to. Netting a purchase against a sale would produce
     * a figure nobody can hand over or be held to, and the two families are
     * settled by different people at different counters.
     *
     * Every type is listed even at zero, so a missing row always means "none in
     * this period" rather than "this figure failed to load".
     */
    private function pharmacyBreakdown(?int $hospitalId, Carbon $from, Carbon $to): array
    {
        $rows = LedgerEntry::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->whereNull('voided_at')
            ->where('module', 'pharmacy')
            ->whereBetween(DB::raw('COALESCE(collected_at, posted_at)'), [$from, $to])
            ->groupBy('category')
            ->selectRaw('category, COUNT(*) as entries, SUM(net_amount) as total_amount,'
                . ' SUM(paid_amount) as paid_amount, SUM(due_amount) as due_amount')
            ->get()
            ->keyBy('category');

        $types = [];
        foreach (self::PHARMACY_TYPES as $category => [$label, $family, $sign]) {
            $row = $rows->get($category);
            $types[] = [
                'category' => $category,
                'label' => $label,
                'family' => $family,
                // -1 for a return, so the client can render it as a deduction
                // rather than having to know which categories are returns.
                'sign' => $sign,
                'entries' => (int) ($row->entries ?? 0),
                'total_amount' => round((float) ($row->total_amount ?? 0), 2),
                'paid_amount' => round((float) ($row->paid_amount ?? 0), 2),
                'due_amount' => round((float) ($row->due_amount ?? 0), 2),
            ];
        }

        $net = function (string $family, string $field) use ($types) {
            return round(array_sum(array_map(
                fn ($t) => $t['family'] === $family ? $t['sign'] * $t[$field] : 0,
                $types
            )), 2);
        };
        $count = fn (string $family) => array_sum(array_map(
            fn ($t) => $t['family'] === $family ? $t['entries'] : 0,
            $types
        ));

        return [
            'types' => $types,
            'totals' => [
                // What the pharmacy actually sold: invoices less what came back.
                // The same definition as the dashboard's Medicine Net Sale, so
                // the two screens cannot report different numbers.
                'sales' => [
                    'label' => 'Net Sales (Invoices − Return In)',
                    'entries' => $count('sales'),
                    'total_amount' => $net('sales', 'total_amount'),
                    'paid_amount' => $net('sales', 'paid_amount'),
                    'due_amount' => $net('sales', 'due_amount'),
                ],
                // Reported beside it, never added to it.
                'purchase' => [
                    'label' => 'Net Purchases (Invoices − Return Out)',
                    'entries' => $count('purchase'),
                    'total_amount' => $net('purchase', 'total_amount'),
                    'paid_amount' => $net('purchase', 'paid_amount'),
                    'due_amount' => $net('purchase', 'due_amount'),
                ],
            ],
        ];
    }

    /**
     * Per-module figures, for the filter chips and the totals panels.
     *
     * Scoped to the chosen window like everything else on the screen. It used
     * to report all-time outstanding, so a chip could read "632 · 31,600" beside
     * a list showing today's four charges -- two numbers on one screen that
     * described different periods.
     *
     * One query feeds both the chips and the panels, so the two can never
     * disagree about what a module is owed.
     */
    private function moduleCounts(?int $hospitalId, array $allowed, Carbon $from, Carbon $to): array
    {
        $rows = LedgerEntry::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->whereNull('voided_at')
            ->where('entry_direction', 'income')
            ->whereIn('module', array_keys($allowed))
            ->whereBetween(DB::raw('COALESCE(collected_at, posted_at)'), [$from, $to])
            ->groupBy('module')
            ->selectRaw('module, COUNT(*) as entries, SUM(net_amount) as total_amount,'
                . ' SUM(paid_amount) as paid_amount, SUM(due_amount) as due_amount')
            ->get()
            ->keyBy('module');

        $out = [];
        foreach ($allowed as $module => $label) {
            $row = $rows->get($module);
            $out[] = [
                'module' => $module,
                'label' => $label,
                'entries' => (int) ($row->entries ?? 0),
                'total_amount' => round((float) ($row->total_amount ?? 0), 2),
                'paid_amount' => round((float) ($row->paid_amount ?? 0), 2),
                'due_amount' => round((float) ($row->due_amount ?? 0), 2),
                // Kept under its original name so the chips keep working.
                'due_total' => round((float) ($row->due_amount ?? 0), 2),
            ];
        }

        return $out;
    }

    /**
     * Everything the collector may take, across every module they hold.
     *
     * Only income modules contribute. A pharmacy purchase is money leaving the
     * hospital and is reported on its own panel; adding it here would produce a
     * headline figure that is neither takings nor debt.
     */
    private function grandTotal(array $moduleTotals): array
    {
        $sum = fn (string $field) => round(array_sum(array_column($moduleTotals, $field)), 2);

        return [
            'entries' => (int) array_sum(array_column($moduleTotals, 'entries')),
            'total_amount' => $sum('total_amount'),
            'paid_amount' => $sum('paid_amount'),
            'due_amount' => $sum('due_amount'),
        ];
    }

    /**
     * Everything still owed across the modules this user may collect for.
     *
     * Scoped to those modules so the figure is one the collector can actually
     * act on: showing a pharmacy cashier the hospital's whole debt would be a
     * number they can neither settle nor be held to.
     */
    private function outstandingTotal(
        ?int $hospitalId,
        array $modules,
        ?Carbon $from = null,
        ?Carbon $to = null
    ): float {
        if (empty($modules)) {
            return 0.0;
        }

        $query = LedgerEntry::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->whereNull('voided_at')
            ->where('entry_direction', 'income')
            ->whereIn('module', $modules)
            ->where('due_amount', '>', 0);

        // Called both ways on purpose: once for the window on screen, once
        // without for the standing debt shown beside it.
        if ($from && $to) {
            $query->whereBetween(DB::raw('COALESCE(collected_at, posted_at)'), [$from, $to]);
        }

        return round((float) $query->sum('due_amount'), 2);
    }

    /**
     * What this collector has taken inside the chosen window.
     *
     * Same attribution rule as the daily figure -- collected_by, falling back to
     * posted_by -- so a shift total and a day total are counted the same way.
     */
    private function collectedInRange(
        ?int $hospitalId,
        $user,
        array $modules,
        Carbon $from,
        Carbon $to
    ): float {
        if (!$user?->name || empty($modules)) {
            return 0.0;
        }

        return round((float) LedgerEntry::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->whereNull('voided_at')
            ->where('entry_direction', 'income')
            ->whereIn('module', $modules)
            ->whereRaw("COALESCE(NULLIF(collected_by, ''), posted_by) = ?", [$user->name])
            ->whereBetween(DB::raw('COALESCE(collected_at, posted_at)'), [$from, $to])
            ->sum('paid_amount'), 2);
    }

    /**
     * What this collector has taken today, in the modules they may collect for.
     *
     * Keyed on collected_by, not posted_by, for the same reason the handover is:
     * a later edit by someone else must not move the money off their sheet.
     */
    private function collectedToday(?int $hospitalId, $user, array $modules): float
    {
        if (!$user?->name || empty($modules)) {
            return 0.0;
        }

        $today = Carbon::today();

        return round((float) LedgerEntry::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->whereNull('voided_at')
            ->where('entry_direction', 'income')
            ->whereIn('module', $modules)
            ->whereRaw("COALESCE(NULLIF(collected_by, ''), posted_by) = ?", [$user->name])
            ->whereBetween(DB::raw("COALESCE(collected_at, posted_at)"), [$today, $today->copy()->endOfDay()])
            ->sum('paid_amount'), 2);
    }

    /** @return array<int, string> modules whose payments this user may undo. */
    private function reversibleModules($user): array
    {
        $isSuperAdmin = $user && $user->role === 'super_admin';
        $held = (!$isSuperAdmin && method_exists($user, 'permissionNames')) ? $user->permissionNames() : [];

        $modules = [];
        foreach (self::MODULES as $module => [, , , $reversePermission]) {
            if ($isSuperAdmin || in_array($reversePermission, $held, true)) {
                $modules[] = $module;
            }
        }

        return $modules;
    }

    /** @return array<string, string> module => label, for modules this user may collect. */
    private function allowedModules($user): array
    {
        $isSuperAdmin = $user && $user->role === 'super_admin';
        $held = (!$isSuperAdmin && method_exists($user, 'permissionNames')) ? $user->permissionNames() : [];

        $allowed = [];
        foreach (self::MODULES as $module => [$permission, , $label, ]) {
            if ($isSuperAdmin || in_array($permission, $held, true)) {
                $allowed[$module] = $label;
            }
        }

        return $allowed;
    }
}
