<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * One patient's whole record, in date order.
 *
 * Every module keeps its own list, so answering "what has happened to this
 * patient" meant opening nine screens and reading nine date columns. This
 * assembles all of them into a single timeline: appointments, lab orders,
 * x-rays, ultrasounds, surgeries, admissions, prescriptions, medicine sales
 * dental work and ECG studies, newest first, with what each cost and whether
 * it was paid.
 *
 * Read-only by design. This is a place to look things up, not to edit them --
 * each module keeps ownership of its own records.
 */
class PatientHistoryController extends Controller
{
    /**
     * The modules a patient's timeline is assembled from.
     *
     * Each entry says where the rows live, which column dates them, what to
     * call the line, and which columns carry the money. Adding a module to the
     * timeline is adding a row here, not writing another query.
     */
    private function sources(): array
    {
        return [
            [
                'module' => 'Appointment',
                'table' => 'appointments',
                'date' => 'appointment_date',
                'title' => 'COALESCE(NULLIF(appointments.reason, \'\'), \'Consultation\')',
                'reference' => 'appointments.appointment_number',
                'gross' => 'COALESCE(appointments.original_fee_amount, appointments.total_amount, 0)',
                'net' => 'COALESCE(appointments.total_amount, 0)',
                'status' => 'appointments.status',
                'paymentStatus' => 'appointments.payment_status',
                'doctor' => 'doctors.name',
            ],
            [
                'module' => 'Laboratory',
                'table' => 'lab_orders',
                'date' => 'created_at',
                'title' => "CONCAT('Lab Order ', COALESCE(lab_orders.order_number, lab_orders.id))",
                'reference' => 'lab_orders.order_number',
                'gross' => 'COALESCE(lab_orders.total_amount, 0)',
                'net' => 'COALESCE(lab_orders.net_amount, lab_orders.total_amount, 0)',
                'status' => 'lab_orders.status',
                'paymentStatus' => 'lab_orders.payment_status',
                // Lab orders snapshot the doctor's name on the order itself,
                // which is the only trustworthy one here: the doctor_id on
                // these rows can point outside the hospital.
                'doctor' => 'lab_orders.doctor_name',
                'softDelete' => 'deleted_at',
            ],
            [
                'module' => 'X-Ray',
                'table' => 'xray_receipts',
                'date' => 'performed_at',
                'title' => 'COALESCE(xray_receipts.study_name, xray_types.name, \'X-Ray\')',
                'reference' => 'xray_receipts.receipt_number',
                'gross' => 'COALESCE(xray_receipts.fee, 0)',
                'net' => 'COALESCE(xray_receipts.net_amount, xray_receipts.fee, 0)',
                'status' => "'completed'",
                'paymentStatus' => 'xray_receipts.payment_status',
                'doctor' => 'COALESCE(doctors.name, xray_receipts.referred_by)',
                'join' => ['xray_types', 'xray_types.id', 'xray_receipts.xray_type_id'],
                'softDelete' => 'deleted_at',
            ],
            [
                'module' => 'Ultrasound',
                'table' => 'ultrasound_exams',
                'date' => 'examined_at',
                'title' => 'COALESCE(ultrasound_types.name, \'Ultrasound\')',
                'reference' => 'ultrasound_exams.receipt_number',
                'gross' => 'COALESCE(ultrasound_exams.fee, 0)',
                'net' => 'COALESCE(ultrasound_exams.net_amount, ultrasound_exams.fee, 0)',
                'status' => 'ultrasound_exams.status',
                'paymentStatus' => 'ultrasound_exams.payment_status',
                'doctor' => 'COALESCE(doctors.name, ultrasound_exams.referred_by)',
                'join' => ['ultrasound_types', 'ultrasound_types.id', 'ultrasound_exams.ultrasound_type_id'],
                'softDelete' => 'deleted_at',
            ],
            [
                'module' => 'Surgery',
                'table' => 'patient_surgeries',
                'date' => 'surgery_date',
                'title' => 'COALESCE(surgeries.name, \'Surgery\')',
                'reference' => 'patient_surgeries.id',
                'gross' => 'COALESCE(patient_surgeries.cost, 0)',
                'net' => 'COALESCE(patient_surgeries.net_amount, patient_surgeries.cost, 0)',
                'status' => 'patient_surgeries.status',
                'paymentStatus' => 'patient_surgeries.payment_status',
                'doctor' => 'doctors.name',
                'join' => ['surgeries', 'surgeries.id', 'patient_surgeries.surgery_id'],
                'flagDelete' => 'is_delete',
            ],
            [
                'module' => 'Room Booking',
                'table' => 'room_bookings',
                'date' => 'booking_date',
                'title' => "CONCAT('Admission — ', COALESCE(rooms.room_number, 'Room'))",
                'reference' => 'room_bookings.bed_number',
                'gross' => 'COALESCE(room_bookings.total_cost, 0)',
                'net' => 'COALESCE(room_bookings.net_amount, room_bookings.total_cost, 0)',
                'status' => 'room_bookings.status',
                'paymentStatus' => 'room_bookings.payment_status',
                'doctor' => 'doctors.name',
                'join' => ['rooms', 'rooms.id', 'room_bookings.room_id'],
                'flagDelete' => 'is_delete',
            ],
            [
                'module' => 'Prescription',
                'table' => 'prescriptions',
                'date' => 'created_at',
                'title' => "CONCAT('Prescription ', COALESCE(prescriptions.prescription_number, prescriptions.id))",
                'reference' => 'prescriptions.prescription_number',
                'gross' => '0',
                'net' => '0',
                'status' => "COALESCE(prescriptions.status, 'issued')",
                'paymentStatus' => "''",
                // Prescriptions snapshot the prescriber's name on the row.
                'doctor' => "COALESCE(prescriptions.doctor_name, doctors.name)",
                'softDelete' => 'deleted_at',
            ],
            [
                'module' => 'Pharmacy',
                'table' => 'transactions',
                'date' => 'created_at',
                'title' => "CONCAT('Medicine Sale #', transactions.serial_no)",
                'reference' => 'transactions.serial_no',
                'gross' => 'COALESCE(transactions.grand_total, 0)',
                'net' => 'COALESCE(transactions.grand_total, 0)',
                'status' => 'transactions.trx_type',
                'paymentStatus' => 'transactions.payment_status',
                // A medicine sale is raised by the counter, not by a doctor,
                // and the table has no doctor_id to join on at all.
                'doctor' => 'NULL',
                'noDoctor' => true,
                // Purchases and supplier returns belong to the pharmacy's own
                // books, not to a patient's medical history.
                'extraScope' => fn ($q) => $q->whereIn('transactions.trx_type', ['sales', 'sales_return']),
            ],
            [
                'module' => 'Dental',
                'table' => 'dental_receipts',
                'date' => 'performed_at',
                // The receipt's own joined service names first: a receipt can now
                // carry several services, and the catalogue join names only one.
                'title' => 'COALESCE(NULLIF(dental_receipts.service_name, \'\'), dental_services.name, \'Dental Treatment\')',
                'reference' => 'dental_receipts.receipt_number',
                'gross' => 'COALESCE(dental_receipts.fee, 0)',
                'net' => 'COALESCE(dental_receipts.net_amount, dental_receipts.fee, 0)',
                'status' => "'completed'",
                'paymentStatus' => 'dental_receipts.payment_status',
                'doctor' => 'doctors.name',
                'join' => ['dental_services', 'dental_services.id', 'dental_receipts.dental_service_id'],
                'softDelete' => 'deleted_at',
            ],
            [
                'module' => 'ECG',
                'table' => 'ecg_receipts',
                'date' => 'performed_at',
                'title' => 'COALESCE(ecg_services.name, \'ECG\')',
                'reference' => 'ecg_receipts.receipt_number',
                'gross' => 'COALESCE(ecg_receipts.fee, 0)',
                'net' => 'COALESCE(ecg_receipts.net_amount, ecg_receipts.fee, 0)',
                'status' => "'completed'",
                'paymentStatus' => 'ecg_receipts.payment_status',
                'doctor' => 'doctors.name',
                'join' => ['ecg_services', 'ecg_services.id', 'ecg_receipts.ecg_service_id'],
                'softDelete' => 'deleted_at',
            ],
        ];
    }

    public function show(Request $request, Patient $patient)
    {
        $user = $request->user();

        if ($user && $user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $patient->hospital_id) {
            abort(403, 'This patient belongs to another hospital.');
        }

        [$from, $to] = $this->dateRange($request);
        $onlyModule = $request->string('module')->toString();

        $events = collect();
        $skipped = [];

        foreach ($this->sources() as $source) {
            if ($onlyModule !== '' && $source['module'] !== $onlyModule) {
                continue;
            }

            try {
                $events = $events->concat($this->eventsFor($source, $patient, $from, $to));
            } catch (\Throwable $e) {
                /*
                 * One module failing must not blank the whole timeline.
                 *
                 * These tables vary between deployments -- a column this query
                 * names may simply not exist on an older schema -- and losing
                 * the other eight modules because of it would be a much worse
                 * answer than showing them and naming what is missing.
                 */
                $skipped[] = $source['module'];
            }
        }

        $sorted = $events->sortByDesc(fn ($event) => $event['date'] ?? '')->values();

        return response()->json([
            'patient' => [
                'id' => $patient->id,
                'patient_id' => $patient->patient_id,
                'name' => $patient->name,
                'phone' => $patient->phone,
                'age' => $patient->age,
                'gender' => $patient->gender,
                'address' => $patient->address ?? null,
                'hospital_id' => $patient->hospital_id,
                'registered_at' => optional($patient->created_at)->toDateString(),
            ],
            'rows' => $sorted,
            'summary' => [
                'events' => $sorted->count(),
                'modules' => $sorted->pluck('module')->unique()->count(),
                'billed' => round((float) $sorted->sum('net_amount'), 2),
                'first_visit' => optional($sorted->last())['date'] ?? null,
                'last_visit' => optional($sorted->first())['date'] ?? null,
            ],
            'meta' => [
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'by_module' => $sorted->groupBy('module')->map->count(),
                'skipped_modules' => $skipped,
            ],
        ]);
    }

    /**
     * One record from the timeline, in full.
     *
     * Returns a deliberately generic shape -- a list of labelled fields plus an
     * optional table of line items -- rather than each module's own JSON. Nine
     * modules would otherwise mean nine renderers in the browser, and the
     * viewer only ever needs to READ this: it is a lookup, not an editor.
     *
     *   { module, title, fields: [{label, value}], items: {columns, rows} }
     */
    public function event(Request $request, Patient $patient, string $module, int $id)
    {
        $user = $request->user();

        if ($user && $user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $patient->hospital_id) {
            abort(403, 'This patient belongs to another hospital.');
        }

        $source = collect($this->sources())->firstWhere('module', $module);

        if (!$source) {
            return response()->json(['message' => 'Unknown module'], 404);
        }

        $table = $source['table'];

        // Scoped to the patient AND the hospital, so an id from one patient's
        // timeline cannot be used to read another's record.
        $row = DB::table($table)
            ->where($table . '.id', $id)
            ->where($table . '.patient_id', $patient->id)
            ->where($table . '.hospital_id', $patient->hospital_id)
            ->first();

        if (!$row) {
            return response()->json(['message' => 'Record not found'], 404);
        }

        return response()->json([
            'module' => $module,
            'title' => $this->eventTitle($module, $row),
            'fields' => $this->eventFields($module, $row),
            'items' => $this->eventItems($module, $row),
        ]);
    }

    private function eventTitle(string $module, $row): string
    {
        return match ($module) {
            'Laboratory' => 'Lab Order ' . ($row->order_number ?: $row->id),
            'Prescription' => 'Prescription ' . ($row->prescription_number ?: $row->id),
            'Pharmacy' => 'Medicine Sale #' . $row->serial_no,
            default => $module,
        };
    }

    /**
     * The labelled fields for one record.
     *
     * Only columns that exist on the row are read, so a deployment whose schema
     * is a migration or two behind shows fewer fields rather than erroring.
     */
    private function eventFields(string $module, $row): array
    {
        $pick = function (array $map) use ($row) {
            $fields = [];
            foreach ($map as $column => $label) {
                if (!property_exists($row, $column)) {
                    continue;
                }
                $value = $row->{$column};
                if ($value === null || $value === '') {
                    continue;
                }

                /*
                 * Rich-text columns (diagnosis, advice, report_body) are stored
                 * as HTML by the editor that writes them. The viewer renders
                 * plain text, so the markup is stripped here rather than sent
                 * to the browser -- putting stored HTML into the page would be
                 * a stored-XSS hole, and "<p>PAIN</p>" is not readable anyway.
                 * The block tags become line breaks first so paragraphs do not
                 * run together into one word.
                 */
                $text = preg_replace('/<(br|\/p|\/div|\/li)[^>]*>/i', "\n", (string) $value);
                $text = trim(html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
                $text = preg_replace("/\n{3,}/", "\n\n", $text);

                if ($text === '') {
                    continue;
                }

                $fields[] = ['label' => $label, 'value' => $text];
            }
            return $fields;
        };

        $money = ['fee' => 'Fee', 'cost' => 'Cost', 'total_amount' => 'Total', 'total_cost' => 'Total',
            'discount_amount' => 'Discount', 'net_amount' => 'Net', 'paid_amount' => 'Paid',
            'payment_status' => 'Payment', 'payment_method' => 'Method'];

        return match ($module) {
            'Laboratory' => $pick(['order_number' => 'Order No', 'doctor_name' => 'Doctor',
                'priority' => 'Priority', 'status' => 'Status', 'clinical_notes' => 'Clinical Notes',
                'remarks' => 'Remarks'] + $money),
            'Prescription' => $pick(['prescription_number' => 'Prescription No', 'doctor_name' => 'Doctor',
                'diagnosis' => 'Diagnosis', 'advice' => 'Advice', 'next_visit' => 'Next Visit',
                'status' => 'Status']),
            'Appointment' => $pick(['appointment_number' => 'Appointment No', 'appointment_date' => 'Date',
                'appointment_time' => 'Time', 'reason' => 'Reason', 'status' => 'Status',
                'notes' => 'Notes'] + $money),
            'X-Ray' => $pick(['receipt_number' => 'Receipt No', 'study_name' => 'Study',
                'referred_by' => 'Referred By', 'performed_at' => 'Performed', 'notes' => 'Notes'] + $money),
            'Ultrasound' => $pick(['receipt_number' => 'Receipt No', 'referred_by' => 'Referred By',
                'examined_at' => 'Examined', 'status' => 'Status', 'clinical_notes' => 'Clinical Notes',
                'impression' => 'Impression', 'report_body' => 'Report'] + $money),
            'Surgery' => $pick(['surgery_date' => 'Date', 'status' => 'Status',
                'discharge_date' => 'Discharged', 'notes' => 'Notes',
                'discharge_summary' => 'Discharge Summary'] + $money),
            'Room Booking' => $pick(['booking_date' => 'Booked', 'check_in_date' => 'Check In',
                'check_out_date' => 'Check Out', 'bed_number' => 'Bed', 'status' => 'Status',
                'remarks' => 'Remarks'] + $money),
            'Pharmacy' => $pick(['serial_no' => 'Invoice No', 'trx_type' => 'Type',
                'grand_total' => 'Total', 'total_discount' => 'Discount', 'paid_amount' => 'Paid',
                'due_amount' => 'Due', 'payment_status' => 'Payment', 'payment_method' => 'Method']),
            'Dental' => $pick(['receipt_number' => 'Receipt No', 'performed_at' => 'Performed',
                'notes' => 'Notes'] + $money),
            'ECG' => $pick(['receipt_number' => 'Receipt No', 'performed_at' => 'Performed',
                'referred_by' => 'Referred By', 'notes' => 'Notes'] + $money),
            default => [],
        };
    }

    /**
     * The line items, where the record has any.
     *
     * Lab results are nested a level deeper than the rest -- results belong to
     * an ITEM, not to the order -- so they are flattened into one table with
     * the test name repeated, which is how a printed report reads anyway.
     */
    private function eventItems(string $module, $row): ?array
    {
        if ($module === 'Prescription') {
            $rows = DB::table('prescription_items')
                ->where('prescription_id', $row->id)
                ->get(['medicine_name', 'strength', 'dose', 'duration', 'instruction', 'quantity']);

            if ($rows->isEmpty()) {
                return null;
            }

            return [
                'columns' => ['Medicine', 'Strength', 'Dose', 'Duration', 'Instruction', 'Qty'],
                'rows' => $rows->map(fn ($item) => [
                    $item->medicine_name, $item->strength, $item->dose,
                    $item->duration, $item->instruction, (string) $item->quantity,
                ])->all(),
            ];
        }

        // Studies and services on a multi-line receipt, with what each cost.
        if ($module === 'X-Ray' || $module === 'Dental') {
            [$table, $fk, $name, $label] = $module === 'X-Ray'
                ? ['xray_receipt_details', 'xray_receipt_id', 'study_name', 'Study']
                : ['dental_receipt_details', 'dental_receipt_id', 'service_name', 'Service'];

            $rows = DB::table($table)->where($fk, $row->id)->orderBy('sort_order')->orderBy('id')->get([$name, 'fee']);

            if ($rows->isEmpty()) {
                return null;
            }

            return [
                'columns' => [$label, 'Fee'],
                'rows' => $rows->map(fn ($item) => [
                    $item->{$name}, number_format((float) $item->fee, 2),
                ])->all(),
            ];
        }

        if ($module === 'Laboratory') {
            $rows = DB::table('lab_order_items')
                ->leftJoin('lab_order_results', 'lab_order_results.lab_order_item_id', '=', 'lab_order_items.id')
                ->where('lab_order_items.lab_order_id', $row->id)
                ->orderBy('lab_order_items.id')
                ->get([
                    'lab_order_items.test_name',
                    'lab_order_results.parameter_name',
                    'lab_order_results.result_value',
                    'lab_order_results.unit',
                    'lab_order_results.normal_range',
                    'lab_order_results.result_status',
                ]);

            if ($rows->isEmpty()) {
                return null;
            }

            return [
                'columns' => ['Test', 'Parameter', 'Result', 'Unit', 'Normal Range', 'Flag'],
                'rows' => $rows->map(fn ($item) => [
                    $item->test_name, $item->parameter_name, $item->result_value,
                    $item->unit, $item->normal_range, $item->result_status,
                ])->all(),
            ];
        }

        if ($module === 'Pharmacy') {
            $rows = DB::table('transaction_details')
                ->leftJoin('medicines', 'medicines.id', '=', 'transaction_details.medicine_id')
                ->where('transaction_details.trx_id', $row->id)
                ->get([
                    'medicines.brand_name',
                    'transaction_details.batch_no',
                    'transaction_details.qtty',
                    'transaction_details.sale_unit',
                    'transaction_details.price',
                    'transaction_details.amount',
                ]);

            if ($rows->isEmpty()) {
                return null;
            }

            return [
                'columns' => ['Medicine', 'Batch', 'Qty', 'Unit', 'Price', 'Amount'],
                'rows' => $rows->map(fn ($item) => [
                    $item->brand_name, $item->batch_no, (string) $item->qtty,
                    $item->sale_unit, (string) $item->price, (string) $item->amount,
                ])->all(),
            ];
        }

        return null;
    }

    private function eventsFor(array $source, Patient $patient, CarbonImmutable $from, CarbonImmutable $to)
    {
        $table = $source['table'];

        $query = DB::table($table)
            ->where($table . '.patient_id', $patient->id)
            ->where($table . '.hospital_id', $patient->hospital_id)
            ->whereBetween($table . '.' . $source['date'], [$from, $to]);

        // The doctor join is hospital-matched for the same reason the reports
        // do it: a doctor_id here can point at another site's doctor, and
        // naming them on a patient's record would be a clinical error.
        if (empty($source['noDoctor'])) {
            $query->leftJoin('doctors', function ($join) use ($table) {
                $join->on('doctors.id', '=', $table . '.doctor_id')
                    ->on('doctors.hospital_id', '=', $table . '.hospital_id');
            });
        }

        if (isset($source['join'])) {
            [$joinTable, $left, $right] = $source['join'];
            $query->leftJoin($joinTable, $left, '=', $right);
        }

        if (isset($source['softDelete'])) {
            $query->whereNull($table . '.' . $source['softDelete']);
        }

        if (isset($source['flagDelete'])) {
            $query->where($table . '.' . $source['flagDelete'], false);
        }

        if (isset($source['extraScope'])) {
            ($source['extraScope'])($query);
        }

        return $query
            ->selectRaw($table . '.id')
            ->selectRaw($table . '.' . $source['date'] . ' as event_date')
            ->selectRaw($source['title'] . ' as title')
            ->selectRaw('CAST(' . $source['reference'] . ' AS CHAR) as reference')
            ->selectRaw($source['gross'] . ' as gross_amount')
            ->selectRaw($source['net'] . ' as net_amount')
            ->selectRaw($source['status'] . ' as status')
            ->selectRaw($source['paymentStatus'] . ' as payment_status')
            ->selectRaw($source['doctor'] . ' as doctor_name')
            ->get()
            ->map(fn ($row) => [
                'id' => $source['module'] . '-' . $row->id,
                'module' => $source['module'],
                'date' => $row->event_date ? CarbonImmutable::parse($row->event_date)->toDateTimeString() : null,
                'title' => $row->title ?: $source['module'],
                'reference' => $row->reference ?: null,
                'doctor_name' => $row->doctor_name ?: null,
                'gross_amount' => round((float) $row->gross_amount, 2),
                'net_amount' => round((float) $row->net_amount, 2),
                'status' => $row->status ?: null,
                'payment_status' => $row->payment_status ?: null,
            ]);
    }

    /**
     * The timeline defaults to everything, not to this month.
     *
     * A medical history with an implicit one-month window is the wrong default:
     * the question is almost always "has this patient been here before", and a
     * blank screen would answer it wrongly.
     */
    private function dateRange(Request $request): array
    {
        $from = $request->filled('date_from')
            ? CarbonImmutable::parse($request->string('date_from')->toString())->startOfDay()
            : CarbonImmutable::create(1900, 1, 1);

        $to = $request->filled('date_to')
            ? CarbonImmutable::parse($request->string('date_to')->toString())->endOfDay()
            : CarbonImmutable::now()->endOfDay();

        return $from->greaterThan($to) ? [$to->startOfDay(), $from->endOfDay()] : [$from, $to];
    }
}
