<?php

namespace App\Http\Controllers\Reports;

use App\Http\Controllers\Controller;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * The clinical and money desks of the Reports module.
 *
 * Surgery, Room Booking, X-Ray, Ultrasound, Expenses and Other Income are six
 * different documents that a report asks the same six questions of: when, for
 * whom, by which doctor, charged how much, discounted how much, and how much of
 * it was actually collected. Rather than six near-identical controllers that
 * drift apart one column at a time, each desk is a DESK DEFINITION -- table,
 * column names, joins -- and one query builder reads them all.
 *
 * Every method returns the shared report envelope:
 *
 *   { rows: [...], summary: {...}, meta: {...} }
 */
class ClinicalReportController extends Controller
{
    /**
     * What each desk is made of.
     *
     * `gross`/`net`/`paid` are column EXPRESSIONS, not just names, because the
     * modules genuinely differ: an X-Ray receipt records `paid_amount`, while a
     * surgery records only a payment_status and its net becomes collected in
     * full the moment it is marked paid. Writing that difference down here
     * keeps it out of the query builder.
     */
    private function desks(): array
    {
        // Surgery and room bookings carry no paid_amount column: they are
        // settled in one go, so "paid" is the whole net once the status says
        // paid and nothing before that.
        $paidFromStatus = fn (string $table, string $net) =>
            "CASE WHEN {$table}.payment_status = 'paid' THEN COALESCE({$table}.{$net}, 0) ELSE 0 END";

        return [
            'surgery' => [
                'table' => 'patient_surgeries',
                'date' => 'surgery_date',
                'gross' => 'COALESCE(patient_surgeries.cost, 0)',
                'net' => 'COALESCE(patient_surgeries.net_amount, patient_surgeries.cost, 0)',
                'discount' => 'COALESCE(patient_surgeries.discount_amount, 0)',
                'paid' => $paidFromStatus('patient_surgeries', 'net_amount'),
                'joins' => [
                    ['patients', 'patients.id', 'patient_surgeries.patient_id'],
                    ['doctors', 'doctors.id', 'patient_surgeries.doctor_id'],
                    ['surgeries', 'surgeries.id', 'patient_surgeries.surgery_id'],
                ],
                'service' => 'surgeries.name',
                'serviceLabel' => 'Surgery',
                // Soft-deleted rows are flags on the table, not a SoftDeletes
                // trait, so they have to be excluded by hand.
                'scope' => fn ($q) => $q->where('patient_surgeries.is_delete', false),
                'title' => 'Surgery Report',
            ],
            'room-booking' => [
                'table' => 'room_bookings',
                'date' => 'booking_date',
                'gross' => 'COALESCE(room_bookings.total_cost, 0)',
                'net' => 'COALESCE(room_bookings.net_amount, room_bookings.total_cost, 0)',
                'discount' => 'COALESCE(room_bookings.discount_amount, 0)',
                'paid' => $paidFromStatus('room_bookings', 'net_amount'),
                'joins' => [
                    ['patients', 'patients.id', 'room_bookings.patient_id'],
                    ['doctors', 'doctors.id', 'room_bookings.doctor_id'],
                    ['rooms', 'rooms.id', 'room_bookings.room_id'],
                ],
                'service' => 'rooms.room_number',
                'serviceLabel' => 'Room',
                'scope' => fn ($q) => $q->where('room_bookings.is_delete', false),
                'title' => 'Room Booking Report',
            ],
            'xray' => [
                'table' => 'xray_receipts',
                'date' => 'performed_at',
                'gross' => 'COALESCE(xray_receipts.fee, 0)',
                'net' => 'COALESCE(xray_receipts.net_amount, xray_receipts.fee, 0)',
                'discount' => 'COALESCE(xray_receipts.discount_amount, 0)',
                'paid' => 'COALESCE(xray_receipts.paid_amount, 0)',
                'joins' => [
                    ['patients', 'patients.id', 'xray_receipts.patient_id'],
                    ['doctors', 'doctors.id', 'xray_receipts.doctor_id'],
                    ['xray_types', 'xray_types.id', 'xray_receipts.xray_type_id'],
                ],
                'doctorLabel' => "NULLIF(TRIM(xray_receipts.referred_by), '')",
                'service' => 'COALESCE(xray_receipts.study_name, xray_types.name)',
                'serviceLabel' => 'Study',
                'title' => 'X-Ray Report',
            ],
            'ultrasound' => [
                'table' => 'ultrasound_exams',
                'date' => 'examined_at',
                'gross' => 'COALESCE(ultrasound_exams.fee, 0)',
                'net' => 'COALESCE(ultrasound_exams.net_amount, ultrasound_exams.fee, 0)',
                'discount' => 'COALESCE(ultrasound_exams.discount_amount, 0)',
                'paid' => 'COALESCE(ultrasound_exams.paid_amount, 0)',
                'joins' => [
                    ['patients', 'patients.id', 'ultrasound_exams.patient_id'],
                    ['doctors', 'doctors.id', 'ultrasound_exams.doctor_id'],
                    ['ultrasound_types', 'ultrasound_types.id', 'ultrasound_exams.ultrasound_type_id'],
                ],
                'doctorLabel' => "NULLIF(TRIM(ultrasound_exams.referred_by), '')",
                'service' => 'ultrasound_types.name',
                'serviceLabel' => 'Exam Type',
                'title' => 'Ultrasound Report',
            ],
        ];
    }

    public function surgery(Request $request)
    {
        return $this->deskReport($request, 'surgery');
    }

    public function roomBooking(Request $request)
    {
        return $this->deskReport($request, 'room-booking');
    }

    public function xray(Request $request)
    {
        return $this->deskReport($request, 'xray');
    }

    public function ultrasound(Request $request)
    {
        return $this->deskReport($request, 'ultrasound');
    }

    /**
     * Doctors that actually appear on this desk in this period.
     *
     * Populated from the desk's own rows rather than from the full doctor
     * list: offering 40 doctors when 3 performed surgeries this month means
     * most choices return an empty report, which reads as a broken filter.
     *
     * Scoped to the hospital twice over -- the rows are the hospital's, and
     * baseQuery's doctor join matches on hospital too, so a record pointing at
     * another site's doctor contributes nothing here rather than putting a
     * stranger in this hospital's dropdown.
     */
    public function doctors(Request $request, string $desk)
    {
        $definition = $this->desks()[$desk] ?? null;

        if (!$definition) {
            return response()->json(['message' => 'Unknown report desk'], 404);
        }

        $hospitalId = $this->hospitalId($request);
        [$from, $to] = $this->dateRange($request);

        $query = $this->baseQuery($definition, $hospitalId, $from, $to);

        // The same label the Doctor Wise tab groups on, so the two can never
        // offer different names for the same work -- radiology in particular
        // falls back to the referring clinician typed on the receipt.
        $doctorName = isset($definition['doctorLabel'])
            ? "COALESCE(doctors.name, {$definition['doctorLabel']})"
            : 'doctors.name';

        $rows = $query
            ->whereRaw("{$doctorName} IS NOT NULL")
            // By name, not by id: duplicate doctor rows sharing one name would
            // otherwise fill the dropdown with identical entries.
            ->groupByRaw('name')
            ->selectRaw("{$doctorName} as name")
            ->selectRaw('MIN(doctors.id) as id')
            ->selectRaw('COUNT(*) as entries')
            ->orderByRaw('name')
            ->get()
            ->map(fn ($row) => [
                'id' => (int) $row->id,
                'name' => $row->name ?: 'Unassigned',
                'entries' => (int) $row->entries,
            ]);

        return response()->json(['rows' => $rows, 'summary' => [], 'meta' => ['desk' => $desk]]);
    }

    private function deskReport(Request $request, string $desk)
    {
        $definition = $this->desks()[$desk];
        $hospitalId = $this->hospitalId($request);
        [$from, $to] = $this->dateRange($request);
        $groupBy = $request->string('group_by')->toString() ?: 'detail';

        $table = $definition['table'];
        $base = $this->baseQuery($definition, $hospitalId, $from, $to);

        /*
         * Who to name as the doctor.
         *
         * `doctors.name` only survives the hospital-matched join when the
         * reference is genuinely this hospital's. Radiology additionally keeps
         * a free-text `referred_by`, which is the referring clinician as typed
         * on the receipt -- worth showing when the foreign key gave us nothing,
         * because it is what the desk actually wrote down.
         */
        $doctorName = isset($definition['doctorLabel'])
            ? "COALESCE(doctors.name, {$definition['doctorLabel']}, 'Unassigned')"
            : "COALESCE(doctors.name, 'Unassigned')";

        // Doctor is matched by NAME, not by id. Duplicate doctor rows sharing
        // one name are common here, so an id filter would return one slice of
        // that person's work and quietly hide the rest.
        if ($request->filled('doctor_name')) {
            $base->whereRaw("{$doctorName} = ?", [$request->string('doctor_name')->toString()]);
        } elseif ($request->filled('doctor_id')) {
            $base->where('doctors.id', $request->integer('doctor_id'));
        }

        if ($request->filled('payment_status')) {
            $base->where($table . '.payment_status', $request->string('payment_status')->toString());
        }

        $net = $definition['net'];
        $gross = $definition['gross'];
        $discount = $definition['discount'];
        $paid = $definition['paid'];
        $due = "({$net}) - ({$paid})";

        if ($groupBy === 'doctor') {
            $rows = (clone $base)
                // Grouped by the resolved NAME, not by doctor_id. Several
                // doctor rows can share a name (this database has dozens of
                // duplicates), and a Doctor Wise report that lists the same
                // person eight times is not a summary of anything.
                // Grouped on the SELECT alias rather than repeating the
                // expression: MySQL's ONLY_FULL_GROUP_BY does not always
                // recognise a repeated COALESCE(...) as the same expression,
                // and rejects the query even though the two are identical.
                ->groupByRaw('doctor_name')
                ->selectRaw("{$doctorName} as doctor_name")
                ->selectRaw("MIN({$table}.doctor_id) as doctor_id")
                ->selectRaw('COUNT(*) as entries')
                ->selectRaw("SUM({$gross}) as gross_total")
                ->selectRaw("SUM({$discount}) as discount_total")
                ->selectRaw("SUM({$net}) as net_total")
                ->selectRaw("SUM({$paid}) as paid_total")
                ->selectRaw("SUM({$due}) as due_total")
                ->orderByDesc('net_total')
                ->get()
                ->map(fn ($r) => [
                    'doctor_id' => $r->doctor_id,
                    'doctor_name' => $r->doctor_name,
                    'entries' => (int) $r->entries,
                    'gross_total' => round((float) $r->gross_total, 2),
                    'discount_total' => round((float) $r->discount_total, 2),
                    'net_total' => round((float) $r->net_total, 2),
                    'paid_total' => round((float) $r->paid_total, 2),
                    'due_total' => round((float) $r->due_total, 2),
                ]);
        } elseif ($groupBy === 'date') {
            $rows = (clone $base)
                ->groupByRaw("DATE({$table}.{$definition['date']})")
                ->selectRaw("DATE({$table}.{$definition['date']}) as day")
                ->selectRaw('COUNT(*) as entries')
                ->selectRaw("SUM({$gross}) as gross_total")
                ->selectRaw("SUM({$discount}) as discount_total")
                ->selectRaw("SUM({$net}) as net_total")
                ->selectRaw("SUM({$paid}) as paid_total")
                ->selectRaw("SUM({$due}) as due_total")
                ->orderBy('day')
                ->get()
                ->map(fn ($r) => [
                    'day' => (string) $r->day,
                    'entries' => (int) $r->entries,
                    'gross_total' => round((float) $r->gross_total, 2),
                    'discount_total' => round((float) $r->discount_total, 2),
                    'net_total' => round((float) $r->net_total, 2),
                    'paid_total' => round((float) $r->paid_total, 2),
                    'due_total' => round((float) $r->due_total, 2),
                ]);
        } elseif ($groupBy === 'service') {
            $rows = (clone $base)
                ->groupByRaw($definition['service'])
                ->selectRaw($definition['service'] . ' as service_name')
                ->selectRaw('COUNT(*) as entries')
                ->selectRaw("SUM({$gross}) as gross_total")
                ->selectRaw("SUM({$discount}) as discount_total")
                ->selectRaw("SUM({$net}) as net_total")
                ->selectRaw("SUM({$paid}) as paid_total")
                ->selectRaw("SUM({$due}) as due_total")
                ->orderByDesc('net_total')
                ->get()
                ->map(fn ($r) => [
                    'service_name' => $r->service_name ?: '-',
                    'entries' => (int) $r->entries,
                    'gross_total' => round((float) $r->gross_total, 2),
                    'discount_total' => round((float) $r->discount_total, 2),
                    'net_total' => round((float) $r->net_total, 2),
                    'paid_total' => round((float) $r->paid_total, 2),
                    'due_total' => round((float) $r->due_total, 2),
                ]);
        } else {
            $rows = (clone $base)
                ->selectRaw($table . '.id')
                ->selectRaw("{$table}.{$definition['date']} as entry_date")
                ->selectRaw($table . '.payment_status')
                ->selectRaw("COALESCE(patients.name, 'Walk-in') as patient_name")
                ->selectRaw('patients.patient_id as patient_code')
                ->selectRaw("{$doctorName} as doctor_name")
                ->selectRaw($definition['service'] . ' as service_name')
                ->selectRaw("{$gross} as gross_amount")
                ->selectRaw("{$discount} as discount_amount")
                ->selectRaw("{$net} as net_amount")
                ->selectRaw("{$paid} as paid_amount")
                ->selectRaw("{$due} as due_amount")
                ->orderByDesc($table . '.' . $definition['date'])
                ->orderByDesc($table . '.id')
                ->get()
                ->map(fn ($r) => [
                    'id' => $r->id,
                    'entry_date' => $r->entry_date
                        ? CarbonImmutable::parse($r->entry_date)->toDateString()
                        : null,
                    'patient_name' => $r->patient_name,
                    'patient_code' => $r->patient_code,
                    'doctor_name' => $r->doctor_name,
                    'service_name' => $r->service_name ?: '-',
                    'gross_amount' => round((float) $r->gross_amount, 2),
                    'discount_amount' => round((float) $r->discount_amount, 2),
                    'net_amount' => round((float) $r->net_amount, 2),
                    'paid_amount' => round((float) $r->paid_amount, 2),
                    'due_amount' => round((float) $r->due_amount, 2),
                    'payment_status' => $r->payment_status,
                ]);
        }

        $totals = (clone $base)
            ->selectRaw('COUNT(*) as entries')
            ->selectRaw("COALESCE(SUM({$gross}), 0) as gross_total")
            ->selectRaw("COALESCE(SUM({$discount}), 0) as discount_total")
            ->selectRaw("COALESCE(SUM({$net}), 0) as net_total")
            ->selectRaw("COALESCE(SUM({$paid}), 0) as paid_total")
            ->selectRaw("COALESCE(SUM({$due}), 0) as due_total")
            ->first();

        return response()->json([
            'rows' => $rows,
            'summary' => [
                'entries' => (int) $totals->entries,
                'gross_total' => round((float) $totals->gross_total, 2),
                'discount_total' => round((float) $totals->discount_total, 2),
                'net_total' => round((float) $totals->net_total, 2),
                'paid_total' => round((float) $totals->paid_total, 2),
                'due_total' => round((float) $totals->due_total, 2),
            ],
            'meta' => [
                'desk' => $desk,
                'title' => $definition['title'],
                'service_label' => $definition['serviceLabel'],
                'group_by' => $groupBy,
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'doctor_id' => $request->filled('doctor_id') ? $request->integer('doctor_id') : null,
            ],
        ]);
    }

    private function baseQuery(array $definition, ?int $hospitalId, CarbonImmutable $from, CarbonImmutable $to)
    {
        $table = $definition['table'];

        $query = DB::table($table)
            ->when($hospitalId, fn ($q) => $q->where($table . '.hospital_id', $hospitalId))
            ->whereBetween($table . '.' . $definition['date'], [$from, $to]);

        foreach ($definition['joins'] as [$joinTable, $left, $right]) {
            if ($joinTable === 'doctors') {
                /*
                 * The doctor join is additionally matched on hospital.
                 *
                 * doctor_id on these tables cannot be trusted to stay inside
                 * the hospital: this database has clinical records whose
                 * doctor_id points at a doctor row belonging to a different
                 * hospital entirely, so a plain join printed another site's
                 * doctor as though they had operated here. Matching the
                 * hospital as part of the join turns a cross-hospital
                 * reference into NULL -- which reads as "Unassigned" and is
                 * true -- instead of into someone else's name, which is not.
                 */
                $query->leftJoin($joinTable, function ($join) use ($left, $right, $table) {
                    $join->on($left, '=', $right)
                        ->on('doctors.hospital_id', '=', $table . '.hospital_id');
                });
                continue;
            }

            $query->leftJoin($joinTable, $left, '=', $right);
        }

        if (isset($definition['scope'])) {
            ($definition['scope'])($query);
        }

        return $query;
    }

    /* --------------------------------------------------- money desks */

    /**
     * Expense Report.
     *
     * Lives under Reports rather than under the Expenses data-entry screens:
     * the person who reads it is not the person who types the entries, and
     * every other report in the hospital is found in one place.
     */
    public function expenses(Request $request)
    {
        return $this->moneyReport($request, [
            'table' => 'expenses',
            'categoryTable' => 'expense_categories',
            'categoryKey' => 'expense_category_id',
            'date' => 'expense_date',
            'title' => 'Expense Report',
        ]);
    }

    /** Other Income Report. The mirror image of the expense report. */
    public function otherIncome(Request $request)
    {
        return $this->moneyReport($request, [
            'table' => 'other_incomes',
            'categoryTable' => 'other_income_categories',
            'categoryKey' => 'other_income_category_id',
            'date' => 'income_date',
            'title' => 'Other Income Report',
        ]);
    }

    private function moneyReport(Request $request, array $definition)
    {
        $hospitalId = $this->hospitalId($request);
        [$from, $to] = $this->dateRange($request);
        $groupBy = $request->string('group_by')->toString() ?: 'detail';

        $table = $definition['table'];
        $categoryTable = $definition['categoryTable'];

        $base = DB::table($table)
            ->when($hospitalId, fn ($q) => $q->where($table . '.hospital_id', $hospitalId))
            ->leftJoin($categoryTable, $categoryTable . '.id', '=', $table . '.' . $definition['categoryKey'])
            ->whereBetween($table . '.' . $definition['date'], [$from->toDateString(), $to->toDateString()]);

        if ($request->filled('category_id')) {
            $base->where($table . '.' . $definition['categoryKey'], $request->integer('category_id'));
        }

        if ($request->filled('payment_method')) {
            $base->where($table . '.payment_method', $request->string('payment_method')->toString());
        }

        // Cancelled or draft rows are not money that moved, so they stay out of
        // the totals unless explicitly asked for.
        if ($request->filled('status')) {
            $base->where($table . '.status', $request->string('status')->toString());
        }

        $amount = "COALESCE({$table}.amount, 0)";

        if ($groupBy === 'category') {
            $rows = (clone $base)
                ->groupBy($table . '.' . $definition['categoryKey'], $categoryTable . '.name')
                ->selectRaw("COALESCE({$categoryTable}.name, 'Uncategorised') as category_name")
                ->selectRaw('COUNT(*) as entries')
                ->selectRaw("SUM({$amount}) as amount_total")
                ->orderByDesc('amount_total')
                ->get()
                ->map(fn ($r) => [
                    'category_name' => $r->category_name,
                    'entries' => (int) $r->entries,
                    'amount_total' => round((float) $r->amount_total, 2),
                ]);
        } elseif ($groupBy === 'date') {
            $rows = (clone $base)
                ->groupBy($table . '.' . $definition['date'])
                ->selectRaw($table . '.' . $definition['date'] . ' as day')
                ->selectRaw('COUNT(*) as entries')
                ->selectRaw("SUM({$amount}) as amount_total")
                ->orderBy('day')
                ->get()
                ->map(fn ($r) => [
                    'day' => (string) $r->day,
                    'entries' => (int) $r->entries,
                    'amount_total' => round((float) $r->amount_total, 2),
                ]);
        } elseif ($groupBy === 'method') {
            $rows = (clone $base)
                ->groupBy($table . '.payment_method')
                ->selectRaw("COALESCE({$table}.payment_method, 'Unspecified') as payment_method")
                ->selectRaw('COUNT(*) as entries')
                ->selectRaw("SUM({$amount}) as amount_total")
                ->orderByDesc('amount_total')
                ->get()
                ->map(fn ($r) => [
                    'payment_method' => $r->payment_method,
                    'entries' => (int) $r->entries,
                    'amount_total' => round((float) $r->amount_total, 2),
                ]);
        } else {
            $rows = (clone $base)
                ->selectRaw($table . '.id, ' . $table . '.sequence_id, ' . $table . '.title')
                ->selectRaw($table . '.' . $definition['date'] . ' as entry_date')
                ->selectRaw("COALESCE({$categoryTable}.name, 'Uncategorised') as category_name")
                ->selectRaw($table . '.payment_method, ' . $table . '.reference, ' . $table . '.status')
                ->selectRaw("{$amount} as amount")
                ->orderByDesc($table . '.' . $definition['date'])
                ->orderByDesc($table . '.id')
                ->get()
                ->map(fn ($r) => [
                    'id' => $r->id,
                    'sequence_id' => $r->sequence_id,
                    'entry_date' => (string) $r->entry_date,
                    'title' => $r->title,
                    'category_name' => $r->category_name,
                    'payment_method' => $r->payment_method ?: '-',
                    'reference' => $r->reference ?: '-',
                    'status' => $r->status,
                    'amount' => round((float) $r->amount, 2),
                ]);
        }

        $totals = (clone $base)
            ->selectRaw('COUNT(*) as entries')
            ->selectRaw("COALESCE(SUM({$amount}), 0) as amount_total")
            ->first();

        return response()->json([
            'rows' => $rows,
            'summary' => [
                'entries' => (int) $totals->entries,
                'amount_total' => round((float) $totals->amount_total, 2),
            ],
            'meta' => [
                'title' => $definition['title'],
                'group_by' => $groupBy,
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
            ],
        ]);
    }

    /* ------------------------------------------------------------ shared */

    /**
     * Which hospital's data this request may see. A non-super-admin is pinned
     * to their own hospital regardless of what the query string asks for.
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
     * Inclusive day range, defaulting to the current month.
     *
     * `to` is pushed to the end of its day, or a report run "1 Sep to 1 Sep"
     * against a datetime column would return only rows stamped exactly midnight.
     */
    private function dateRange(Request $request): array
    {
        $from = $request->filled('date_from')
            ? CarbonImmutable::parse($request->string('date_from')->toString())->startOfDay()
            : CarbonImmutable::today()->startOfMonth();

        $to = $request->filled('date_to')
            ? CarbonImmutable::parse($request->string('date_to')->toString())->endOfDay()
            : CarbonImmutable::today()->endOfDay();

        return $from->greaterThan($to) ? [$to->startOfDay(), $from->endOfDay()] : [$from, $to];
    }
}
