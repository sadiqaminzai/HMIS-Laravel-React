<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\Hospital;
use App\Models\HospitalSetting;
use App\Models\LabOrder;
use App\Models\LedgerEntry;
use App\Models\Manufacturer;
use App\Models\Medicine;
use App\Models\User;
use App\Models\TransactionDetail;
use App\Models\MedicineType;
use App\Models\Patient;
use App\Models\PatientSurgery;
use App\Models\Prescription;
use App\Models\Room;
use App\Models\RoomBooking;
use App\Models\Surgery;
use App\Models\UltrasoundExam;
use App\Models\XrayReceipt;
use App\Models\TestTemplate;
use App\Support\PharmacyCosting;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class DashboardController extends Controller
{
    public function summary(Request $request)
    {
        $user = $request->user();

        $dateFilter = $request->input('date_filter');
        $startDate = null;
        $endDate = null;

        if ($dateFilter) {
            switch ($dateFilter) {
                case 'today':
                    $startDate = Carbon::today();
                    $endDate = Carbon::today()->endOfDay();
                    break;
                case 'yesterday':
                    $startDate = Carbon::yesterday();
                    $endDate = Carbon::yesterday()->endOfDay();
                    break;
                case 'this_month':
                    $startDate = Carbon::now()->startOfMonth();
                    $endDate = Carbon::now()->endOfMonth();
                    break;
                case 'last_month':
                    $startDate = Carbon::now()->subMonth()->startOfMonth();
                    $endDate = Carbon::now()->subMonth()->endOfMonth();
                    break;
                case 'this_year':
                    $startDate = Carbon::now()->startOfYear();
                    $endDate = Carbon::now()->endOfYear();
                    break;
                case 'last_7_days':
                    $startDate = Carbon::today()->subDays(6);
                    $endDate = Carbon::today()->endOfDay();
                    break;
                case 'all_time':
                    /*
                     * Everything the hospital has ever recorded.
                     *
                     * Bounded rather than left null: the whole page assumes a
                     * range exists, and leaving the dates unset would silently
                     * fall through to "today" -- which is exactly the opposite
                     * of what was asked for. The lower bound is the earliest
                     * ledger entry, so the range covers the real history
                     * without inventing a date.
                     */
                    $earliest = LedgerEntry::query()
                        ->when($request->integer('hospital_id'), fn ($q) => $q->where('hospital_id', $request->integer('hospital_id')))
                        ->min('posted_at');

                    $startDate = $earliest
                        ? Carbon::parse($earliest)->startOfDay()
                        : Carbon::today()->subYears(10)->startOfDay();
                    $endDate = Carbon::today()->endOfDay();
                    break;
                case 'custom':
                    // Any range the user picks. Parsed defensively: a malformed
                    // date must not throw, and a reversed range is swapped
                    // rather than silently returning nothing.
                    try {
                        $from = $request->filled('start_date')
                            ? Carbon::parse($request->input('start_date'))->startOfDay()
                            : null;
                        $to = $request->filled('end_date')
                            ? Carbon::parse($request->input('end_date'))->endOfDay()
                            : null;
                    } catch (\Throwable) {
                        $from = $to = null;
                    }

                    if ($from && $to && $from->greaterThan($to)) {
                        [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
                    }

                    // A one-sided range is still useful: "everything since X".
                    $startDate = $from ?: ($to ? $to->copy()->startOfDay() : null);
                    $endDate = $to ?: ($from ? $from->copy()->endOfDay() : null);
                    break;
            }
        }

        $hospitalId = null;
        if ($user && $user->role === 'super_admin') {
            $hospitalId = $request->integer('hospital_id') ?: null;
        } else {
            $hospitalId = $user?->hospital_id;
        }

        if (!$hospitalId && (!$user || $user->role !== 'super_admin')) {
            return response()->json(['message' => 'Hospital is required'], 422);
        }

        $hospitalsQuery = Hospital::query();
        if ($hospitalId) {
            $hospitalsQuery->where('id', $hospitalId);
        } elseif ($user && $user->role !== 'super_admin') {
            $hospitalsQuery->where('id', $user->hospital_id);
        }

        $hospitals = $hospitalsQuery
            ->orderBy('name')
            // The licence dates and contact details come through too: the
            // dashboard card is where a manager notices a licence about to
            // lapse, and it cannot warn about a date it was never sent.
            ->get([
                'id', 'name', 'code', 'status', 'email', 'phone', 'address',
                'license', 'license_issue_date', 'license_expiry_date',
                'subscription_status', 'timezone',
            ]);

        $counts = [
            'hospitals' => $hospitalId ? 1 : Hospital::count(),
            // Counted from `users` where role = doctor, which is the same source
            // the Doctors screen and appointment booking read. The legacy
            // `doctors` table has drifted -- hospital 4 holds 30 rows there
            // against 16 real doctor accounts -- so counting it reported staff
            // the hospital does not have.
            'doctors' => User::query()
                ->where('role', 'doctor')
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->count(),
            'active_doctors' => User::query()
                ->where('role', 'doctor')
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->where(function ($q) {
                    // `users` has no `status`; availability is `doctor_status`,
                    // and `is_active` governs the account itself. A row with
                    // neither set counts as active, matching the Doctors list.
                    $q->whereNull('doctor_status')->orWhere('doctor_status', 'active');
                })
                ->where(function ($q) {
                    $q->whereNull('is_active')->orWhere('is_active', 1);
                })
                ->count(),
            // All-time, deliberately. These sit under "Overall Totals" and were
            // filtered by the date range, so a hospital with 2,072 patients
            // reported 137 whenever "Yesterday" was selected. The range-limited
            // figures are returned separately below.
            'patients' => Patient::query()
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->count(),
            'prescriptions' => Prescription::query()
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->count(),
            // ... and the same two for the selected range, for the Activity panel.
            'patients_period' => Patient::query()
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->when($startDate,
                    fn ($q) => $q->whereBetween('created_at', [$startDate, $endDate]),
                    fn ($q) => $q->whereDate('created_at', Carbon::today())
                )
                ->count(),
            'prescriptions_period' => Prescription::query()
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->when($startDate,
                    fn ($q) => $q->whereBetween('created_at', [$startDate, $endDate]),
                    fn ($q) => $q->whereDate('created_at', Carbon::today())
                )
                ->count(),
            // Catalogue sizes, guarded on the tables existing so a server that
            // has the code but not yet the migration still renders.
            'dental_services' => Schema::hasTable('dental_services')
                ? DB::table('dental_services')
                    ->whereNull('deleted_at')
                    ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->count()
                : 0,
            'ecg_services' => Schema::hasTable('ecg_services')
                ? DB::table('ecg_services')
                    ->whereNull('deleted_at')
                    ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->count()
                : 0,
            'xray_types' => Schema::hasTable('xray_types')
                ? DB::table('xray_types')
                    ->whereNull('deleted_at')
                    ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->count()
                : 0,
            'medicines' => Medicine::query()->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))->count(),
            'manufacturers' => Manufacturer::query()->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))->count(),
            'medicine_types' => MedicineType::query()->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))->count(),
            'test_templates' => TestTemplate::query()->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))->count(),
            'rooms' => Room::query()
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->where('is_delete', false)
                ->count(),
            'active_rooms' => Room::query()
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->where('is_delete', false)
                ->where('is_active', true)
                ->count(),
            'surgeries' => Surgery::query()
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->where('is_delete', false)
                ->count(),
            'lab_orders_today' => LabOrder::query()
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->when($startDate,
                    fn ($q) => $q->whereBetween('created_at', [$startDate, $endDate]),
                    fn ($q) => $q->whereDate('created_at', Carbon::today())
                )
                ->count(),
            // Ultrasound and X-Ray, counted over the same window and by the
            // same rule as the lab orders above.
            'ultrasound_exams_today' => DB::table('ultrasound_exams')
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->when($startDate,
                    fn ($q) => $q->whereBetween('created_at', [$startDate, $endDate]),
                    fn ($q) => $q->whereDate('created_at', Carbon::today())
                )
                ->count(),
            'xray_receipts_today' => DB::table('xray_receipts')
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->when($startDate,
                    fn ($q) => $q->whereBetween('created_at', [$startDate, $endDate]),
                    fn ($q) => $q->whereDate('created_at', Carbon::today())
                )
                ->count(),
            // Guarded on the table existing. The dashboard is the first screen
            // every user lands on, and an unguarded query against a table this
            // deploy has not created yet takes the whole page down with a 500
            // for everyone -- during the window between uploading the code and
            // running the migration, or on any database restored from an older
            // dump. Reports zero until the table is there.
            'dental_receipts_today' => Schema::hasTable('dental_receipts')
                ? DB::table('dental_receipts')
                    ->whereNull('deleted_at')
                    ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->when($startDate,
                        fn ($q) => $q->whereBetween('created_at', [$startDate, $endDate]),
                        fn ($q) => $q->whereDate('created_at', Carbon::today())
                    )
                    ->count()
                : 0,
            'ecg_receipts_today' => Schema::hasTable('ecg_receipts')
                ? DB::table('ecg_receipts')
                    ->whereNull('deleted_at')
                    ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->when($startDate,
                        fn ($q) => $q->whereBetween('created_at', [$startDate, $endDate]),
                        fn ($q) => $q->whereDate('created_at', Carbon::today())
                    )
                    ->count()
                : 0,
            'appointments_today' => Appointment::query()
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->when($startDate,
                    fn ($q) => $q->whereBetween('appointment_date', [$startDate, $endDate]),
                    fn ($q) => $q->whereDate('appointment_date', Carbon::today())
                )
                ->count(),
            'room_bookings_today' => RoomBooking::query()
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->where('is_delete', false)
                ->when($startDate,
                    fn ($q) => $q->whereBetween('check_in_date', [$startDate, $endDate]),
                    fn ($q) => $q->whereDate('check_in_date', Carbon::today())
                )
                ->count(),
            'patient_surgeries_today' => PatientSurgery::query()
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->where('is_delete', false)
                ->when($startDate,
                    fn ($q) => $q->whereBetween('surgery_date', [$startDate, $endDate]),
                    fn ($q) => $q->whereDate('surgery_date', Carbon::today())
                )
                ->count(),
        ];

        $monthly = [];
        $start = Carbon::now()->startOfMonth()->subMonths(5);
        for ($i = 0; $i < 6; $i++) {
            $monthStart = $start->copy()->addMonths($i);
            $monthEnd = $monthStart->copy()->endOfMonth();

            $monthly[] = [
                'month' => $monthStart->format('M'),
                'patients' => Patient::query()
                    ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->whereBetween('created_at', [$monthStart, $monthEnd])
                    ->count(),
                'prescriptions' => Prescription::query()
                    ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->whereBetween('created_at', [$monthStart, $monthEnd])
                    ->count(),
                'appointments' => Appointment::query()
                    ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->whereBetween('appointment_date', [$monthStart, $monthEnd])
                    ->count(),
                'room_bookings' => RoomBooking::query()
                    ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->where('is_delete', false)
                    ->whereBetween('check_in_date', [$monthStart->toDateString(), $monthEnd->toDateString()])
                    ->count(),
                'patient_surgeries' => PatientSurgery::query()
                    ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->where('is_delete', false)
                    ->whereBetween('surgery_date', [$monthStart->toDateString(), $monthEnd->toDateString()])
                    ->count(),
                'lab_orders' => LabOrder::query()
                    ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->whereBetween('created_at', [$monthStart, $monthEnd])
                    ->count(),
                'ultrasound' => UltrasoundExam::query()
                    ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->whereBetween('created_at', [$monthStart, $monthEnd])
                    ->count(),
                'xray' => XrayReceipt::query()
                    ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->whereBetween('created_at', [$monthStart, $monthEnd])
                    ->count(),
                'dental' => Schema::hasTable('dental_receipts')
                    ? DB::table('dental_receipts')
                        ->whereNull('deleted_at')
                        ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                        ->whereBetween('created_at', [$monthStart, $monthEnd])
                        ->count()
                    : 0,
                'ecg' => Schema::hasTable('ecg_receipts')
                    ? DB::table('ecg_receipts')
                        ->whereNull('deleted_at')
                        ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                        ->whereBetween('created_at', [$monthStart, $monthEnd])
                        ->count()
                    : 0,
            ];
        }

        /*
         * The selected day, hour by hour.
         *
         * Four grouped queries rather than 4 x 24 counted ones: each returns at
         * most 24 rows and is folded into the buckets below, so adding this
         * chart costs four round trips regardless of how busy the day was.
         *
         * Follows the same date filter as everything else, so "Today Trend"
         * shows yesterday's shape when Yesterday is selected -- the heading on
         * the client names the period.
         */
        $hourStart = $startDate ? $startDate->copy()->startOfDay() : Carbon::today()->startOfDay();
        $hourEnd = $endDate ? $endDate->copy()->endOfDay() : Carbon::today()->endOfDay();

        $hourly = [];
        for ($h = 0; $h < 24; $h++) {
            // 12-hour clock: the wards read "3 PM", not "15:00". Midnight and
            // noon are the two the modulo has to get right.
            $hour12 = $h % 12 === 0 ? 12 : $h % 12;
            $hourly[$h] = [
                'hour' => $hour12 . ' ' . ($h < 12 ? 'AM' : 'PM'),
                'patients' => 0,
                'appointments' => 0,
                'lab_orders' => 0,
                'prescriptions' => 0,
                'ultrasound' => 0,
                'xray' => 0,
                'dental' => 0,
                'ecg' => 0,
                'room_bookings' => 0,
            ];
        }

        $bucket = function ($query, string $column, string $key) use (&$hourly, $hourStart, $hourEnd, $hospitalId) {
            $rows = $query
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->whereBetween($column, [$hourStart, $hourEnd])
                ->selectRaw('HOUR(' . $column . ') as h, COUNT(*) as total')
                ->groupBy('h')
                ->pluck('total', 'h');

            foreach ($rows as $h => $total) {
                if (isset($hourly[(int) $h])) {
                    $hourly[(int) $h][$key] = (int) $total;
                }
            }
        };

        $bucket(Patient::query(), 'created_at', 'patients');
        $bucket(Appointment::query(), 'created_at', 'appointments');
        $bucket(LabOrder::query(), 'created_at', 'lab_orders');
        $bucket(Prescription::query(), 'created_at', 'prescriptions');
        // created_at rather than the clinical date: these charts are about when
        // the desk was busy, and an exam booked for next week was still typed
        // in at 3 PM today.
        $bucket(UltrasoundExam::query(), 'created_at', 'ultrasound');
        $bucket(XrayReceipt::query(), 'created_at', 'xray');
        $bucket(RoomBooking::query()->where('is_delete', false), 'created_at', 'room_bookings');

        if (Schema::hasTable('dental_receipts')) {
            $bucket(DB::table('dental_receipts')->whereNull('deleted_at'), 'created_at', 'dental');
        }

        if (Schema::hasTable('ecg_receipts')) {
            $bucket(DB::table('ecg_receipts')->whereNull('deleted_at'), 'created_at', 'ecg');
        }

        $hourlyTrend = array_values($hourly);

        // Follows the date dropdown like every other figure on the page. It
        // used to count every appointment ever booked, so the chart read 2,187
        // "Scheduled" beside a panel showing a single day's work.
        $appointmentCounts = Appointment::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->when($startDate,
                fn ($q) => $q->whereBetween('appointment_date', [$startDate, $endDate]),
                fn ($q) => $q->whereDate('appointment_date', Carbon::today())
            )
            ->selectRaw('LOWER(status) as status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $appointmentStatusData = [
            ['key' => 'scheduled', 'label' => 'Scheduled', 'color' => '#3b82f6'],
            ['key' => 'completed', 'label' => 'Completed', 'color' => '#10b981'],
            ['key' => 'cancelled', 'label' => 'Cancelled', 'color' => '#ef4444'],
            ['key' => 'no_show', 'label' => 'No Show', 'color' => '#6b7280'],
        ];

        $appointmentStatus = collect($appointmentStatusData)->map(function ($item) use ($appointmentCounts) {
            $count = (int) ($appointmentCounts[$item['key']] ?? $appointmentCounts[str_replace('_', ' ', $item['key'])] ?? 0);
            return [
                'name' => $item['label'],
                'value' => $count,
                'color' => $item['color'],
            ];
        })->values();

        // Same reasoning as the appointment chart above.
        $labCounts = LabOrder::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->when($startDate,
                fn ($q) => $q->whereBetween('created_at', [$startDate, $endDate]),
                fn ($q) => $q->whereDate('created_at', Carbon::today())
            )
            ->selectRaw('LOWER(status) as status, COUNT(*) as total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $testStatusData = collect([
            ['key' => 'pending', 'label' => 'Pending', 'color' => '#f59e0b'],
            ['key' => 'in_progress', 'label' => 'In Progress', 'color' => '#3b82f6'],
            ['key' => 'completed', 'label' => 'Completed', 'color' => '#10b981'],
            ['key' => 'cancelled', 'label' => 'Cancelled', 'color' => '#ef4444'],
        ])->map(function ($item) use ($labCounts) {
            $count = (int) ($labCounts[$item['key']] ?? $labCounts[str_replace('_', ' ', $item['key'])] ?? 0);
            return [
                'name' => $item['label'],
                'value' => $count,
                'color' => $item['color'],
            ];
        })->values();


        $medicineStockQuery = Medicine::query()
            ->when($hospitalId, fn ($q) => $q->where('medicines.hospital_id', $hospitalId));
        /*
         * Stock health, with the money attached.
         *
         * A bare count of "how many medicines are low" cannot be acted on: 40
         * low lines might be 40 cheap ones or the entire antibiotic shelf. Each
         * band now also carries how many packs it represents, so the chart says
         * what is at stake as well as how many rows.
         *
         * "Low" is the medicine's OWN reorder level, not a flat piece count.
         * This band used to be `stock BETWEEN 1 AND 10`, which compared a piece
         * count against the same 10 for tablets, syrups and injections alike:
         * a box of 60 tablets read as healthy at 11 loose tablets, while a
         * syrup with 9 bottles on the shelf read as critical. min_stock is
         * stored in packs and converted here, with the hospital default
         * standing in for products nobody has configured yet.
         *
         * Deliberately shares PharmacyCosting with the Low Stock report, so the
         * donut and the report can never disagree about what "low" means.
         */
        $defaultMinPacks = $hospitalId
            ? (int) (HospitalSetting::query()
                ->where('hospital_id', $hospitalId)
                ->value('default_min_stock_packs') ?? 5)
            : 5;
        $lowStockCondition = PharmacyCosting::lowStockCondition($defaultMinPacks);
        $inStockCondition = 'NOT (' . $lowStockCondition . ') AND COALESCE(medicines.stock, 0) > 0';

        $stockUnits = fn ($q) => (int) $q->sum('stock');

        $medicineStockData = [
            [
                'name' => 'In Stock',
                'value' => (int) (clone $medicineStockQuery)->whereRaw($inStockCondition)->count(),
                'units' => $stockUnits((clone $medicineStockQuery)->whereRaw($inStockCondition)),
                'color' => '#10b981',
            ],
            [
                'name' => 'Low Stock',
                'value' => (int) (clone $medicineStockQuery)->whereRaw($lowStockCondition)->count(),
                'units' => $stockUnits((clone $medicineStockQuery)->whereRaw($lowStockCondition)),
                'color' => '#f59e0b',
            ],
            [
                'name' => 'Out of Stock',
                'value' => (int) (clone $medicineStockQuery)->where('stock', '<=', 0)->count(),
                'units' => 0,
                'color' => '#ef4444',
            ],
        ];

        $recentPatients = Patient::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->latest()
            ->limit(5)
            ->get(['id', 'name', 'patient_id', 'age', 'gender']);

        $recentPrescriptions = Prescription::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->withCount('items')
            ->latest()
            ->limit(5)
            ->get(['id', 'patient_name', 'prescription_number']);

        $recentLabOrders = LabOrder::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->latest()
            ->limit(5)
            ->get(['id', 'patient_name', 'order_number', 'status']);

        $financialStart = $startDate ? $startDate->copy()->startOfDay() : Carbon::today()->startOfDay();
        $financialEnd = $endDate ? $endDate->copy()->endOfDay() : Carbon::today()->endOfDay();

        $dailyLedgerQuery = LedgerEntry::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->whereNull('voided_at')
            ->whereBetween('posted_at', [$financialStart, $financialEnd]);

        /*
         * Collection status for the period.
         *
         * The stock donut says what is on the shelf and the status donuts say
         * what was done; none of them said what has been paid for. This reads
         * the ledger the receipts already post to, so it covers every desk at
         * once, and carries the money as well as the count -- "31 unpaid" means
         * nothing until you know whether that is 300 or 300,000.
         */
        $collectionRows = (clone $dailyLedgerQuery)
            ->where('entry_direction', 'income')
            ->selectRaw(
                'SUM(CASE WHEN due_amount <= 0 THEN 1 ELSE 0 END) as paid_count,'
                . ' SUM(CASE WHEN due_amount <= 0 THEN net_amount ELSE 0 END) as paid_amount,'
                . ' SUM(CASE WHEN due_amount > 0 AND paid_amount > 0 THEN 1 ELSE 0 END) as partial_count,'
                . ' SUM(CASE WHEN due_amount > 0 AND paid_amount > 0 THEN due_amount ELSE 0 END) as partial_amount,'
                . ' SUM(CASE WHEN due_amount > 0 AND paid_amount <= 0 THEN 1 ELSE 0 END) as unpaid_count,'
                . ' SUM(CASE WHEN due_amount > 0 AND paid_amount <= 0 THEN due_amount ELSE 0 END) as unpaid_amount'
            )
            ->first();

        $collectionStatus = [
            [
                'name' => 'Paid',
                'value' => (int) ($collectionRows->paid_count ?? 0),
                'amount' => round((float) ($collectionRows->paid_amount ?? 0), 2),
                'color' => '#10b981',
            ],
            [
                'name' => 'Partly Paid',
                'value' => (int) ($collectionRows->partial_count ?? 0),
                'amount' => round((float) ($collectionRows->partial_amount ?? 0), 2),
                'color' => '#f59e0b',
            ],
            [
                'name' => 'Unpaid',
                'value' => (int) ($collectionRows->unpaid_count ?? 0),
                'amount' => round((float) ($collectionRows->unpaid_amount ?? 0), 2),
                'color' => '#ef4444',
            ],
        ];

        // Weighted average cost per piece, from the purchases that actually
        // delivered the stock. The reasoning lives in PharmacyCosting, which is
        // also what the Pharmacy Profit report uses -- a profit figure and a
        // stock valuation that disagree about what a pack cost are worse than
        // either one alone, so there is exactly one copy of this arithmetic.
        $unitCosts = PharmacyCosting::unitCosts($hospitalId);

        $totalStockCostAmount = round((float) Medicine::query()
            ->when($hospitalId, fn ($q) => $q->where('medicines.hospital_id', $hospitalId))
            ->leftJoinSub($unitCosts, 'uc', 'uc.medicine_id', '=', 'medicines.id')
            ->selectRaw(
                'COALESCE(SUM(COALESCE(medicines.stock, 0) * COALESCE(uc.unit_cost,'
                . ' COALESCE(medicines.cost_price, 0) / GREATEST(COALESCE(medicines.pack_size, 1), 1))), 0)'
                . ' as total_stock_cost_amount'
            )
            ->value('total_stock_cost_amount'), 2);

        /*
         * Cost of the medicine actually sold in the period.
         *
         * Reuses the same weighted-average unit cost as the stock valuation
         * above, so "profit" and "stock worth" cannot disagree about what a
         * pack cost. base_bonus is included: free goods leave the shelf and
         * have to be paid for out of the margin on what was charged.
         *
         * Sales returns carry a negative sign because the stock came back --
         * their cost is no longer a cost of sale.
         */
        $medicineCogs = round((float) TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.trx_id')
            ->leftJoinSub($unitCosts, 'uc', 'uc.medicine_id', '=', 'transaction_details.medicine_id')
            ->leftJoin('medicines', 'medicines.id', '=', 'transaction_details.medicine_id')
            ->whereIn('transactions.trx_type', ['sales', 'sales_return'])
            ->when($hospitalId, fn ($q) => $q->where('transactions.hospital_id', $hospitalId))
            ->whereBetween('transactions.created_at', [$financialStart, $financialEnd])
            ->selectRaw(
                'COALESCE(SUM('
                . ' (CASE WHEN transactions.trx_type = \'sales_return\' THEN -1 ELSE 1 END)'
                . ' * (COALESCE(transaction_details.base_qtty, 0) + COALESCE(transaction_details.base_bonus, 0))'
                . ' * COALESCE(uc.unit_cost, COALESCE(medicines.cost_price, 0)'
                . ' / GREATEST(COALESCE(medicines.pack_size, 1), 1))'
                . '), 0) as cogs'
            )
            ->value('cogs'), 2);

        // Returning goods to a supplier brings cash in, but it is not trading
        // income -- it is inventory going back out. Excluded here and netted
        // against inventory below, so income means "what we actually earned".
        $totalIncome = round((float) (clone $dailyLedgerQuery)
            ->where('entry_direction', 'income')
            ->where(function ($query) {
                $query->whereNull('module')
                    ->orWhere('module', '!=', 'pharmacy')
                    ->orWhere('category', '!=', 'purchase_return');
            })
            ->sum('net_amount'), 2);

        $purchaseReturns = round((float) (clone $dailyLedgerQuery)
            ->where('entry_direction', 'income')
            ->where('module', 'pharmacy')
            ->where('category', 'purchase_return')
            ->sum('net_amount'), 2);

        $totalSalary = round((float) (clone $dailyLedgerQuery)
            ->where('entry_direction', 'expense')
            ->where('module', 'salary')
            ->sum('net_amount'), 2);

        // Buying stock is not an expense -- it exchanges cash for an asset that
        // is already reported as Available Stock. Counting it here made a
        // restocking pharmacy look catastrophically unprofitable and double
        // counted the same money (once as a loss, once as inventory).
        //
        // It is still shown, on its own tile, because the cash really did leave.
        // A sales return is also cash out that adds stock back, so it belongs
        // with inventory rather than with rent and utilities.
        $inventoryPurchases = round((float) (clone $dailyLedgerQuery)
            ->where('entry_direction', 'expense')
            ->where('module', 'pharmacy')
            ->whereIn('category', ['purchase', 'sales_return'])
            ->sum('net_amount') - $purchaseReturns, 2);

        // Operating expenses: what the hospital actually consumes -- rent,
        // utilities, supplies. Salary is reported separately.
        $totalExpenses = round((float) (clone $dailyLedgerQuery)
            ->where('entry_direction', 'expense')
            ->where(function ($query) {
                $query->whereNull('module')
                    ->orWhere('module', '!=', 'salary');
            })
            ->where(function ($query) {
                $query->whereNull('module')
                    ->orWhere('module', '!=', 'pharmacy')
                    ->orWhereNotIn('category', ['purchase', 'sales_return']);
            })
            ->sum('net_amount'), 2);

        $totalExpensesWithSalary = round($totalExpenses + $totalSalary, 2);

        $totalOtherIncome = round((float) (clone $dailyLedgerQuery)
            ->where('module', 'other_income')
            ->where('entry_direction', 'income')
            ->sum('net_amount'), 2);

        $salesInvoiceAmount = round((float) (clone $dailyLedgerQuery)
            ->where('module', 'pharmacy')
            ->where('category', 'sales')
            ->sum('net_amount'), 2);

        // A sales return is posted on the expense side (cash back to the
        // customer, stock back on the shelf), so it has to be subtracted here
        // rather than summed with the invoices.
        $salesReturnAmount = round((float) (clone $dailyLedgerQuery)
            ->where('module', 'pharmacy')
            ->where('category', 'sales_return')
            ->sum('net_amount'), 2);

        // A refund is not income. The sale was counted gross above, and the
        // refund is deliberately excluded from expenses (it is not a cost, it
        // is a reversal), so without this correction the money handed back to
        // the customer never left the revenue figure at all -- Revenue Total
        // was overstated by exactly the day's returns while the Medicine Net
        // Sale tile beside it already showed them deducted.
        //
        // Applied to income at source so everything derived from it agrees:
        // total_income, total_revenue and total_cash_flow.
        $totalIncome = round($totalIncome - $salesReturnAmount, 2);

        $dailyFinancials = [
            'report_date' => $financialStart->toDateString(),
            'report_period_start' => $financialStart->toDateString(),
            'report_period_end' => $financialEnd->toDateString(),
            'currency' => 'AFN',
            'total_stock_cost_amount' => $totalStockCostAmount,
            'total_fees' => round((float) (clone $dailyLedgerQuery)
                ->where('module', 'appointments')
                ->where('entry_direction', 'income')
                ->sum('net_amount'), 2),
            'total_lab_fees' => round((float) (clone $dailyLedgerQuery)
                ->where('module', 'laboratory')
                ->where('entry_direction', 'income')
                ->sum('net_amount'), 2),
            'total_surgery_fees' => round((float) (clone $dailyLedgerQuery)
                ->where('module', 'surgery')
                ->where('entry_direction', 'income')
                ->sum('net_amount'), 2),
            'total_room_fees' => round((float) (clone $dailyLedgerQuery)
                ->where('module', 'room_booking')
                ->where('entry_direction', 'income')
                ->sum('net_amount'), 2),
            // Ultrasound posts under 'radiology' and X-Ray under its own
            // module (see LedgerPostingService), so they are two separate
            // sums rather than one radiology figure.
            'total_ultrasound_fees' => round((float) (clone $dailyLedgerQuery)
                ->where('module', 'radiology')
                ->where('entry_direction', 'income')
                ->sum('net_amount'), 2),
            'total_xray_fees' => round((float) (clone $dailyLedgerQuery)
                ->where('module', 'xray')
                ->where('entry_direction', 'income')
                ->sum('net_amount'), 2),
            // net_amount, like every other line here: what the hospital is
            // owed after any discount, not the list price.
            'total_dental_fees' => round((float) (clone $dailyLedgerQuery)
                ->where('module', 'dental')
                ->where('entry_direction', 'income')
                ->sum('net_amount'), 2),
            'total_ecg_fees' => round((float) (clone $dailyLedgerQuery)
                ->where('module', 'ecg')
                ->where('entry_direction', 'income')
                ->sum('net_amount'), 2),
            'total_sales_invoice_amount' => $salesInvoiceAmount,
            'total_sales_return_amount' => $salesReturnAmount,
            // What the pharmacy actually kept: invoices less goods handed back.
            // The gross invoice figure alone overstated takings on any day a
            // customer returned medicine, because the refund went out through
            // the expense side and never came off the sales tile.
            'total_net_medicine_sale' => round($salesInvoiceAmount - $salesReturnAmount, 2),
            // What the pharmacy actually made: net sales less what the goods
            // cost. Reported beside the sale figure because a large turnover on
            // a thin margin and a small one on a fat margin look identical
            // until the cost is shown.
            'total_medicine_cogs' => $medicineCogs,
            'total_medicine_profit' => round(($salesInvoiceAmount - $salesReturnAmount) - $medicineCogs, 2),
            'total_sales_paid_amount' => round((float) (clone $dailyLedgerQuery)
                ->where('module', 'pharmacy')
                ->where('category', 'sales')
                ->sum('paid_amount'), 2),
            'total_sales_due_amount' => round((float) (clone $dailyLedgerQuery)
                ->where('module', 'pharmacy')
                ->where('category', 'sales')
                ->sum('due_amount'), 2),
            'total_other_income' => $totalOtherIncome,
            'total_income' => $totalIncome,
            'total_expenses' => $totalExpenses,
            'total_inventory_purchases' => $inventoryPurchases,
            'total_salary' => $totalSalary,
            'total_expenses_with_salary' => $totalExpensesWithSalary,
            // Trading result: income less what was consumed. Stock bought but not
            // yet sold is excluded -- it has not been used up, it is on the shelf.
            'total_revenue' => round($totalIncome - $totalExpensesWithSalary, 2),
            // Kept so the cash position is still available to anyone who needs it.
            'total_cash_flow' => round($totalIncome - $totalExpensesWithSalary - $inventoryPurchases, 2),
        ];

        return response()->json($this->applyPanelPermissions($user, [
            'hospital_id' => $hospitalId,
            'hospitals' => $hospitals,
            'counts' => $counts,
            'charts' => [
                'monthly' => $monthly,
                'hourly' => $hourlyTrend,
                'appointment_status' => $appointmentStatus,
                'test_status' => $testStatusData,
                'medicine_stock' => $medicineStockData,
                'collection_status' => $collectionStatus,
            ],
            'financials' => $dailyFinancials,
            'recent' => [
                'patients' => $recentPatients,
                'prescriptions' => $recentPrescriptions,
                'lab_orders' => $recentLabOrders,
            ],
        ]));
    }

    /**
     * Daily finance submission (handover) report.
     *
     * At the end of a shift a user hands their collected amounts to the finance
     * officer, and this is the paper that goes with the cash.
     *
     * There is deliberately no permission of its own. A revenue area appears in
     * the report exactly when the user is allowed to see that total on the
     * dashboard -- give a desk the room booking total and room bookings start
     * being included, remove it and they stop. One permission per total, used
     * for both purposes, rather than a parallel set that can drift out of step
     * and leave a user printing figures they cannot see on screen.
     *
     * Totals the user may not see are never computed, let alone returned.
     */
    /**
     * Who is signed in, per hospital.
     *
     * "Logged in" is taken from the API token's last_used_at rather than from
     * last_login_at: this is a token-authenticated SPA, so a session ends by
     * going quiet, not by anyone pressing Log out. A token touched inside the
     * activity window is someone actually working; last_login_at only ever
     * says when they started.
     *
     * Two queries regardless of headcount -- the users, then one grouped pass
     * over their tokens.
     */
    public function activeUsers(Request $request)
    {
        $user = $request->user();

        if ($user && $user->role !== 'super_admin'
            && !$user->hasAnyPermission(['view_dashboard_active_users', 'view_users', 'manage_users'])) {
            return response()->json(['data' => [], 'message' => 'Not permitted'], 403);
        }

        $hospitalId = $user && $user->role === 'super_admin'
            ? ($request->integer('hospital_id') ?: null)
            : ($user->hospital_id ?? null);

        // Minutes of silence after which someone is treated as gone.
        $windowMinutes = (int) ($request->integer('window') ?: 15);
        $cutoff = now()->subMinutes($windowMinutes);

        $users = User::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->where('is_active', true)
            ->orderByDesc('last_login_at')
            ->limit(100)
            ->get(['id', 'name', 'email', 'role', 'hospital_id', 'last_login_at']);

        $lastSeen = collect();

        if ($users->isNotEmpty() && Schema::hasTable('personal_access_tokens')) {
            $lastSeen = DB::table('personal_access_tokens')
                ->whereIn('tokenable_id', $users->pluck('id'))
                ->where('tokenable_type', User::class)
                ->groupBy('tokenable_id')
                ->selectRaw('tokenable_id, MAX(last_used_at) as last_used_at')
                ->pluck('last_used_at', 'tokenable_id');
        }

        $hospitalNames = DB::table('hospitals')->pluck('name', 'id');

        $rows = $users->map(function ($row) use ($lastSeen, $cutoff, $hospitalNames) {
            $seen = $lastSeen[$row->id] ?? null;
            $seenAt = $seen ? Carbon::parse($seen) : null;

            return [
                'id' => $row->id,
                'name' => $row->name,
                'email' => $row->email,
                'role' => $row->role,
                'hospital_id' => $row->hospital_id,
                'hospital_name' => $hospitalNames[$row->hospital_id] ?? null,
                'last_login_at' => $row->last_login_at,
                'last_seen_at' => $seenAt?->toDateTimeString(),
                'is_online' => $seenAt !== null && $seenAt->greaterThanOrEqualTo($cutoff),
            ];
        })
        // Online first, then whoever was seen most recently.
        ->sortBy([
            fn ($a, $b) => ($b['is_online'] <=> $a['is_online']),
            fn ($a, $b) => (($b['last_seen_at'] ?? '') <=> ($a['last_seen_at'] ?? '')),
        ])
        ->values();

        return response()->json([
            'data' => $rows,
            'online_count' => $rows->where('is_online', true)->count(),
            'total_count' => $rows->count(),
            'window_minutes' => $windowMinutes,
        ]);
    }

    public function financeSubmission(Request $request)
    {
        $user = $request->user();

        $hospitalId = null;
        if ($user && $user->role === 'super_admin') {
            $hospitalId = $request->integer('hospital_id') ?: null;
        } else {
            $hospitalId = $user?->hospital_id;
        }

        if (!$hospitalId && (!$user || $user->role !== 'super_admin')) {
            return response()->json(['message' => 'Hospital is required'], 422);
        }

        try {
            $from = $request->filled('from')
                ? Carbon::parse($request->input('from'))->startOfDay()
                : Carbon::today();
            $to = $request->filled('to')
                ? Carbon::parse($request->input('to'))->endOfDay()
                : Carbon::today()->endOfDay();
        } catch (\Throwable) {
            return response()->json(['message' => 'Invalid date range'], 422);
        }

        // A reversed range is a slip, not an empty report.
        if ($from->greaterThan($to)) {
            [$from, $to] = [$to->copy()->startOfDay(), $from->copy()->endOfDay()];
        }

        $isSuperAdmin = $user && $user->role === 'super_admin';
        $held = (!$isSuperAdmin && method_exists($user, 'permissionNames')) ? $user->permissionNames() : [];
        $can = fn (string $permission) => $isSuperAdmin || in_array($permission, $held, true);

        $base = LedgerEntry::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            // Voided entries are reversals, not money in the drawer; counting
            // them would have the user hand over cash they never took.
            ->whereNull('voided_at')
            ->whereBetween('posted_at', [$from, $to]);

        // Ledger module (and category, where the module carries more than one
        // kind of money) => the permission that reveals it.
        $lines = [
            'appointments' => ['label' => 'Registration / OPD Fees', 'module' => 'appointments', 'permission' => 'view_dashboard_appointment_fees'],
            'laboratory' => ['label' => 'Laboratory Fees', 'module' => 'laboratory', 'permission' => 'view_dashboard_lab_orders_amount'],
            'radiology' => ['label' => 'Ultrasound Fees', 'module' => 'radiology', 'permission' => 'view_dashboard_ultrasound_fees'],
            // X-Ray posts to its own module (see LedgerPostingService), so it
            // needs its own line or its takings would be missing from the
            // day-end sheet entirely.
            'xray' => ['label' => 'X-Ray Fees', 'module' => 'xray', 'permission' => 'view_dashboard_xray_fees'],
            'dental' => ['label' => 'Dental Fees', 'module' => 'dental', 'permission' => 'view_dashboard_dental_fees'],
            'ecg' => ['label' => 'ECG Fees', 'module' => 'ecg', 'permission' => 'view_dashboard_ecg_fees'],
            'surgery' => ['label' => 'Surgery Fees', 'module' => 'surgery', 'permission' => 'view_dashboard_surgery_fees'],
            'room_booking' => ['label' => 'Room Booking Fees', 'module' => 'room_booking', 'permission' => 'view_dashboard_room_booking_fees'],
            'pharmacy' => ['label' => 'Pharmacy Sales', 'module' => 'pharmacy', 'category' => 'sales', 'permission' => 'view_dashboard_medicine_sale'],
            'other_income' => ['label' => 'Other Income', 'module' => 'other_income', 'permission' => 'view_dashboard_other_income'],
        ];

        $permitted = array_filter($lines, fn ($line) => $can($line['permission']));

        // Per-user breakdown. Shifts mean several people collect against the
        // same revenue areas in a day, and each hands over their own takings --
        // a single hospital-wide figure cannot be signed for by one person.
        if ($request->boolean('by_user')) {
            // Seeing what a colleague collected is a supervisory act, so it
            // follows the same admin distinction the rest of the application
            // uses rather than introducing a permission that would duplicate
            // the dashboard ones.
            $seesEveryone = in_array($user?->role, ['super_admin', 'admin'], true);

            // Group by WHO TOOK THE MONEY, not who last saved the document.
            //
            // This used to group by posted_by, which LedgerPostingService fills
            // from updated_by: any later edit moved the cash into the editor's
            // handover. A clerk correcting a lab order after the cashier settled
            // it would find the takings on their own sheet and the cashier's
            // sheet short, which is why one person has had to both enter and
            // collect. collected_by is written only when a payment is actually
            // taken, so it cannot drift.
            //
            // Both columns hold the user's NAME, not an id, so grouping and the
            // single-user match are by name. Two staff sharing a name share a
            // row; that is a property of the schema, not of this report.
            // Summed in PHP rather than with GROUP BY.
            //
            // The collector is an expression -- collected_by, falling back to
            // posted_by for rows written before it existed -- and grouping by an
            // expression trips MariaDB's ONLY_FULL_GROUP_BY, which does not
            // treat the SELECT and GROUP BY expressions as the same one and
            // rejects the query outright. The handover then printed a SQL error
            // where the day's takings should be. One day of collections is a
            // small enough set to add up here, and it removes the dependency on
            // how a particular server happens to be configured.
            $totalsByUser = [];

            foreach ($permitted as $key => $line) {
                $query = (clone $base)
                    ->where('entry_direction', 'income')
                    ->where('module', $line['module']);

                if (isset($line['category'])) {
                    $query->where('category', $line['category']);
                }

                foreach ($query->get(['collected_by', 'posted_by', 'paid_amount']) as $row) {
                    // Entries posted before the collector was recorded fall back
                    // to posted_by, and to Unattributed when neither is set. They
                    // are shown rather than dropped so the rows still add up to
                    // the hospital total -- money that appears to vanish between
                    // two reports is worse than money nobody has claimed.
                    $collector = trim((string) ($row->collected_by ?? '')) !== ''
                        ? (string) $row->collected_by
                        : trim((string) ($row->posted_by ?? ''));

                    if (!$seesEveryone && $collector !== (string) $user?->name) {
                        continue;
                    }

                    $name = $collector !== '' ? $collector : 'Unattributed';
                    $totalsByUser[$name][$key] = round(
                        ($totalsByUser[$name][$key] ?? 0) + (float) $row->paid_amount,
                        2
                    );
                }
            }

            $users = [];
            foreach ($totalsByUser as $name => $amounts) {
                $users[] = [
                    'user_name' => $name,
                    'amounts' => $amounts,
                    'total_amount' => round(array_sum($amounts), 2),
                ];
            }

            usort($users, fn ($a, $b) => $b['total_amount'] <=> $a['total_amount']);

            return response()->json([
                'hospital_id' => $hospitalId,
                'from' => $from->toDateString(),
                'to' => $to->toDateString(),
                'currency' => 'AFN',
                'generated_at' => now()->toDateTimeString(),
                'columns' => array_values(array_map(
                    fn ($key, $line) => ['key' => $key, 'label' => $line['label']],
                    array_keys($permitted),
                    $permitted
                )),
                'users' => $users,
                'grand_total' => round(array_sum(array_column($users, 'total_amount')), 2),
            ]);
        }

        $rows = [];
        $total = 0.0;

        foreach ($permitted as $key => $line) {
            $query = (clone $base)
                ->where('entry_direction', 'income')
                ->where('module', $line['module']);

            if (isset($line['category'])) {
                $query->where('category', $line['category']);
            }

            $amount = round((float) $query->sum('paid_amount'), 2);
            $count = (clone $query)->count();

            $rows[] = [
                'key' => $key,
                'label' => $line['label'],
                'amount' => $amount,
                'entries' => $count,
            ];

            $total += $amount;
        }

        return response()->json([
            'hospital_id' => $hospitalId,
            'from' => $from->toDateString(),
            'to' => $to->toDateString(),
            'currency' => 'AFN',
            'submitted_by' => [
                'id' => $user?->id,
                'name' => $user?->name,
                'role' => $user?->role,
            ],
            'generated_at' => now()->toDateTimeString(),
            'lines' => $rows,
            'total_amount' => round($total, 2),
        ]);
    }

    /**
     * Panels the user may not see are stripped from the payload.
     *
     * Hiding a card in React is not access control -- the figures were still in
     * the JSON for anyone who opened the network tab. Revenue, payroll and stock
     * valuation are exactly the numbers a hospital does not want every role
     * reading, so they are removed here, at the source.
     *
     * The rule mirrors the frontend so the two never disagree: until an
     * administrator grants one of the NEW dashboard permissions, access falls
     * back to the module permissions that governed these figures before, and a
     * hospital that has not configured anything sees no change.
     */
    private function applyPanelPermissions($user, array $payload): array
    {
        if (!$user || $user->role === 'super_admin') {
            return $payload;
        }

        $held = method_exists($user, 'permissionNames') ? $user->permissionNames() : [];
        $can = fn (string $panel) => in_array('view_dashboard_' . $panel, $held, true);

        // Response key => the panel that controls it.
        $financialPanels = [
            'total_stock_cost_amount' => 'available_stock',
            'total_sales_invoice_amount' => 'medicine_sale',
            'total_sales_paid_amount' => 'medicine_sale',
            'total_sales_due_amount' => 'medicine_sale',
            'total_sales_return_amount' => 'medicine_sale',
            'total_net_medicine_sale' => 'medicine_sale',
            'total_fees' => 'appointment_fees',
            'total_lab_fees' => 'lab_orders_amount',
            'total_surgery_fees' => 'surgery_fees',
            'total_room_fees' => 'room_booking_fees',
            'total_ultrasound_fees' => 'ultrasound_fees',
            'total_xray_fees' => 'xray_fees',
            // Was missing: the dental figure was added to the payload without a
            // panel mapping, so it survived the permission filter for everyone.
            'total_dental_fees' => 'dental_fees',
            'total_ecg_fees' => 'ecg_fees',
            'total_medicine_cogs' => 'medicine_profit',
            'total_medicine_profit' => 'medicine_profit',
            'total_expenses' => 'expenses',
            'total_inventory_purchases' => 'inventory_purchases',
            'total_other_income' => 'other_income',
            'total_salary' => 'salary',
            'total_revenue' => 'revenue_total',
            'total_income' => 'revenue_total',
            'total_cash_flow' => 'revenue_total',
            'total_expenses_with_salary' => 'revenue_total',
        ];

        /*
         * Revenue is re-derived from the lines this user may see.
         *
         * The server computes one hospital-wide total; showing that to a
         * pharmacist who may only see medicine sales reports a number they
         * cannot account for, and quietly discloses the income of every desk
         * they were not given access to. Each role now sees the total of its
         * own visible lines.
         */
        $incomeKeys = [
            'total_fees', 'total_lab_fees', 'total_surgery_fees', 'total_room_fees',
            'total_ultrasound_fees', 'total_xray_fees', 'total_dental_fees', 'total_ecg_fees',
            'total_net_medicine_sale', 'total_other_income',
        ];
        $expenseKeys = ['total_expenses', 'total_salary'];

        if ($can('revenue_total')) {
            $visibleIncome = 0.0;
            foreach ($incomeKeys as $key) {
                if ($can($financialPanels[$key] ?? '') && isset($payload['financials'][$key])) {
                    $visibleIncome += (float) $payload['financials'][$key];
                }
            }

            $visibleExpenses = 0.0;
            foreach ($expenseKeys as $key) {
                if ($can($financialPanels[$key] ?? '') && isset($payload['financials'][$key])) {
                    $visibleExpenses += (float) $payload['financials'][$key];
                }
            }

            $payload['financials']['total_revenue'] = round($visibleIncome - $visibleExpenses, 2);
            $payload['financials']['total_income'] = round($visibleIncome, 2);
            $payload['financials']['total_expenses_with_salary'] = round($visibleExpenses, 2);
        }

        $countPanels = [
            'hospitals' => 'count_hospitals',
            'doctors' => 'count_doctors',
            'active_doctors' => 'count_doctors',
            'patients' => 'count_patients',
            'patients_period' => 'count_patients',
            'prescriptions' => 'count_prescriptions',
            'prescriptions_period' => 'count_prescriptions',
            'dental_services' => 'count_dental',
            'ecg_services' => 'count_ecg',
            'xray_types' => 'count_xray',
            'medicines' => 'count_medicines',
            'manufacturers' => 'count_medicines',
            'medicine_types' => 'count_medicines',
            'test_templates' => 'count_test_templates',
            'lab_orders_today' => 'count_lab_tests',
            'ultrasound_exams_today' => 'count_ultrasound',
            'xray_receipts_today' => 'count_xray',
            'dental_receipts_today' => 'count_dental',
            'ecg_receipts_today' => 'count_ecg',
            'appointments_today' => 'count_appointments',
            'rooms' => 'count_rooms',
            'active_rooms' => 'count_rooms',
            'surgeries' => 'count_surgeries',
            'patient_surgeries_today' => 'count_surgeries',
            'room_bookings_today' => 'count_rooms',
        ];

        $chartPanels = [
            'monthly' => 'chart_monthly',
            'hourly' => 'chart_monthly',
            'appointment_status' => 'chart_appointment_status',
            'test_status' => 'chart_test_status',
            'medicine_stock' => 'chart_medicine_stock',
            'collection_status' => 'chart_collection',
        ];

        $recentPanels = [
            'patients' => 'recent_patients',
            'prescriptions' => 'recent_prescriptions',
            'lab_orders' => 'recent_lab_orders',
        ];

        // Zeroed rather than removed, so the client keeps a complete shape and
        // cannot mistake "not permitted" for "endpoint changed".
        foreach ($financialPanels as $key => $panel) {
            if (isset($payload['financials'][$key]) && !$can($panel)) {
                $payload['financials'][$key] = 0;
            }
        }
        foreach ($countPanels as $key => $panel) {
            if (isset($payload['counts'][$key]) && !$can($panel)) {
                $payload['counts'][$key] = 0;
            }
        }
        foreach ($chartPanels as $key => $panel) {
            if (isset($payload['charts'][$key]) && !$can($panel)) {
                $payload['charts'][$key] = [];
            }
        }
        foreach ($recentPanels as $key => $panel) {
            if (isset($payload['recent'][$key]) && !$can($panel)) {
                $payload['recent'][$key] = [];
            }
        }

        return $payload;
    }
}
