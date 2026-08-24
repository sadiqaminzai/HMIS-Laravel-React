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
        'surgery' => ['manage_surgery_payments', 'patient_surgery', 'Surgery', 'reverse_surgery_payment'],
        'room_booking' => ['manage_room_booking_payments', 'room_booking', 'Room Bookings', 'reverse_room_booking_payment'],
        'pharmacy' => ['record_finance_payments', 'transaction', 'Pharmacy Invoices', 'reverse_finance_payment'],
    ];

    /** source_type => table the document lives in, for the existence check. */
    private const SOURCE_TABLES = [
        'appointment' => 'appointments',
        'lab_order' => 'lab_orders',
        'ultrasound_exam' => 'ultrasound_exams',
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
            ->whereIn('ledger_entries.module', $modules)
            ->select([
                'ledger_entries.*',
                'patients.name as patient_name',
                'patients.patient_id as patient_code',
                'patients.phone as patient_phone',
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
            $query->where(function ($q) use ($like) {
                $q->where('ledger_entries.title', 'like', $like)
                    ->orWhere('patients.name', 'like', $like)
                    ->orWhere('patients.patient_id', 'like', $like)
                    ->orWhere('patients.phone', 'like', $like);
            });
        }

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
                'patient_code' => $entry->patient_code,
                'patient_phone' => $entry->patient_phone,
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
            'modules' => $this->moduleCounts($hospitalId, $allowed),
            // The two header figures are the desk's standing totals for the
            // modules this user may collect -- deliberately NOT narrowed by the
            // module chip or the search box, because they are what the drawer is
            // counted against at the end of the day.
            'summary' => [
                'due_total' => $this->outstandingTotal($hospitalId, array_keys($allowed)),
                'entries' => $entries->total(),
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
            'date' => 'ledger_entries.posted_at',
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
            $query->orderByDesc('ledger_entries.posted_at');
        }
        $query->orderByDesc('ledger_entries.id');
    }

    /** Outstanding count and value per module, for the filter chips. */
    private function moduleCounts(?int $hospitalId, array $allowed): array
    {
        $rows = LedgerEntry::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->whereNull('voided_at')
            ->where('entry_direction', 'income')
            ->whereIn('module', array_keys($allowed))
            ->where('due_amount', '>', 0)
            ->groupBy('module')
            ->selectRaw('module, COUNT(*) as entries, SUM(due_amount) as due_total')
            ->get()
            ->keyBy('module');

        $out = [];
        foreach ($allowed as $module => $label) {
            $row = $rows->get($module);
            $out[] = [
                'module' => $module,
                'label' => $label,
                'entries' => (int) ($row->entries ?? 0),
                'due_total' => round((float) ($row->due_total ?? 0), 2),
            ];
        }

        return $out;
    }

    /**
     * Everything still owed across the modules this user may collect for.
     *
     * Scoped to those modules so the figure is one the collector can actually
     * act on: showing a pharmacy cashier the hospital's whole debt would be a
     * number they can neither settle nor be held to.
     */
    private function outstandingTotal(?int $hospitalId, array $modules): float
    {
        if (empty($modules)) {
            return 0.0;
        }

        return round((float) LedgerEntry::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->whereNull('voided_at')
            ->where('entry_direction', 'income')
            ->whereIn('module', $modules)
            ->where('due_amount', '>', 0)
            ->sum('due_amount'), 2);
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
