<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Doctor;
use App\Models\Hospital;
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
use App\Models\TestTemplate;
use Carbon\Carbon;
use Illuminate\Http\Request;

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
            ->get(['id', 'name', 'code', 'status']);

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
            'patients' => Patient::query()
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->when($startDate, fn ($q) => $q->whereBetween('created_at', [$startDate, $endDate]))
                ->count(),
            'prescriptions' => Prescription::query()
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->when($startDate, fn ($q) => $q->whereBetween('created_at', [$startDate, $endDate]))
                ->count(),
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
            ];
        }

        $appointmentCounts = Appointment::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
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

        $labCounts = LabOrder::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
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

        $medicineStockQuery = Medicine::query()->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId));
        $medicineStockData = [
            [
                'name' => 'In Stock',
                'value' => (int) (clone $medicineStockQuery)->where('stock', '>', 10)->count(),
                'color' => '#10b981',
            ],
            [
                'name' => 'Low Stock',
                'value' => (int) (clone $medicineStockQuery)->whereBetween('stock', [1, 10])->count(),
                'color' => '#f59e0b',
            ],
            [
                'name' => 'Out of Stock',
                'value' => (int) (clone $medicineStockQuery)->where('stock', '<=', 0)->count(),
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

        // Stock is held in PIECES while cost_price is quoted per PACK, so the two
        // cannot be multiplied directly: 10 boxes of 60 tablets at 165/box is
        // worth 1,650, not 600 x 165 = 99,000.
        //
        // The per-piece cost comes from the purchases that actually delivered the
        // stock -- SUM(packs x pack price) / SUM(pieces received) -- rather than
        // from the medicine's current pack_size. Packaging is editable, and using
        // today's pack_size to value goods received under a different one makes
        // the stock figure move every time someone corrects a pack size. This is
        // the same reason transaction lines snapshot pack_size_snapshot.
        //
        // Medicines with no purchase history (opening balances, manual entry)
        // fall back to the current cost_price converted per piece.
        $unitCosts = TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.trx_id')
            ->where('transactions.trx_type', 'purchase')
            ->when($hospitalId, fn ($q) => $q->where('transactions.hospital_id', $hospitalId))
            ->groupBy('transaction_details.medicine_id')
            ->selectRaw('transaction_details.medicine_id')
            // Weighted average cost per piece = what the supplier actually
            // billed, divided by every piece that arrived.
            //
            // `amount` is used rather than qtty x price because it is net of the
            // line discount, and base_bonus is included in the divisor because
            // free goods occupy stock without adding cost -- they lower the
            // average, which is what "cost of what we hold" means. Valuing them
            // at list price would report stock worth more than was ever paid.
            ->selectRaw('SUM(transaction_details.amount)'
                . ' / NULLIF(SUM(transaction_details.base_qtty + transaction_details.base_bonus), 0)'
                . ' as unit_cost');

        $totalStockCostAmount = round((float) Medicine::query()
            ->when($hospitalId, fn ($q) => $q->where('medicines.hospital_id', $hospitalId))
            ->leftJoinSub($unitCosts, 'uc', 'uc.medicine_id', '=', 'medicines.id')
            ->selectRaw(
                'COALESCE(SUM(COALESCE(medicines.stock, 0) * COALESCE(uc.unit_cost,'
                . ' COALESCE(medicines.cost_price, 0) / GREATEST(COALESCE(medicines.pack_size, 1), 1))), 0)'
                . ' as total_stock_cost_amount'
            )
            ->value('total_stock_cost_amount'), 2);

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
            'total_sales_invoice_amount' => round((float) (clone $dailyLedgerQuery)
                ->where('module', 'pharmacy')
                ->where('category', 'sales')
                ->sum('net_amount'), 2),
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
                'appointment_status' => $appointmentStatus,
                'test_status' => $testStatusData,
                'medicine_stock' => $medicineStockData,
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
            'total_fees' => 'appointment_fees',
            'total_lab_fees' => 'lab_orders_amount',
            'total_surgery_fees' => 'surgery_fees',
            'total_room_fees' => 'room_booking_fees',
            'total_expenses' => 'expenses',
            'total_inventory_purchases' => 'inventory_purchases',
            'total_other_income' => 'other_income',
            'total_salary' => 'salary',
            'total_revenue' => 'revenue_total',
            'total_income' => 'revenue_total',
            'total_cash_flow' => 'revenue_total',
            'total_expenses_with_salary' => 'revenue_total',
        ];

        $countPanels = [
            'hospitals' => 'count_hospitals',
            'doctors' => 'count_doctors',
            'active_doctors' => 'count_doctors',
            'patients' => 'count_patients',
            'prescriptions' => 'count_prescriptions',
            'medicines' => 'count_medicines',
            'manufacturers' => 'count_medicines',
            'medicine_types' => 'count_medicines',
            'test_templates' => 'count_test_templates',
            'lab_orders_today' => 'count_lab_tests',
            'appointments_today' => 'count_appointments',
            'rooms' => 'count_rooms',
            'active_rooms' => 'count_rooms',
            'surgeries' => 'count_surgeries',
            'patient_surgeries_today' => 'count_surgeries',
            'room_bookings_today' => 'count_rooms',
        ];

        $chartPanels = [
            'monthly' => 'chart_monthly',
            'appointment_status' => 'chart_appointment_status',
            'test_status' => 'chart_test_status',
            'medicine_stock' => 'chart_medicine_stock',
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
