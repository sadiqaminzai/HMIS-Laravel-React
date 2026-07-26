<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\EmployeeAttendance;
use App\Models\LeaveRequest;
use App\Models\PayrollBatch;
use App\Models\PayrollItem;
use App\Models\SalaryStructure;
use App\Services\LedgerPostingService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class PayrollBatchController extends Controller
{
    public function __construct(private readonly LedgerPostingService $ledgerPostingService)
    {
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $query = PayrollBatch::query()->withCount('items');

        if ($request->boolean('include_items')) {
            $query->with([
                'items.employee:id,employee_code,first_name,last_name',
            ]);
        }

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('payroll_month')) {
            $query->where('payroll_month', $request->string('payroll_month'));
        }

        return response()->json($query->orderByDesc('payroll_month')->orderByDesc('id')->get());
    }

    public function store(Request $request)
    {
        $hospitalId = $this->resolveHospitalId($request);
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $this->validateStorePayload($request, $hospitalId);

        $exists = PayrollBatch::query()
            ->where('hospital_id', $hospitalId)
            ->where('payroll_month', $data['payroll_month'])
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'payroll_month' => ['Payroll batch already exists for this month.'],
            ]);
        }

        $data['hospital_id'] = $hospitalId;
        $data['status'] = 'draft';
        $data['total_employees'] = 0;
        $data['gross_amount'] = 0;
        $data['deductions_amount'] = 0;
        $data['net_amount'] = 0;
        $data['created_by'] = $request->user()->name ?? null;
        $data['updated_by'] = $request->user()->name ?? null;

        $batch = PayrollBatch::create($data);

        return response()->json($batch, 201);
    }

    public function show(Request $request, PayrollBatch $payrollBatch)
    {
        $this->authorizeScope($request->user(), $payrollBatch);

        return response()->json($payrollBatch->load(['items.employee:id,employee_code,first_name,last_name']));
    }

    public function update(Request $request, PayrollBatch $payrollBatch)
    {
        $this->authorizeScope($request->user(), $payrollBatch);

        if (in_array($payrollBatch->status, ['posted', 'voided'], true)) {
            abort(422, 'Posted or voided payroll batches cannot be edited.');
        }

        $hospitalId = (int) $payrollBatch->hospital_id;
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $request->validate([
            'currency' => ['nullable', 'string', 'max:10'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['updated_by'] = $request->user()->name ?? null;

        $payrollBatch->update($data);

        return response()->json($payrollBatch->fresh());
    }

    public function generate(Request $request)
    {
        $hospitalId = $this->resolveHospitalId($request);
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $request->validate([
            'hospital_id' => ['required', 'exists:hospitals,id'],
            'payroll_month' => ['required', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'employee_ids' => ['nullable', 'array'],
            'employee_ids.*' => [
                'required',
                Rule::exists('employees', 'id')->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
            ],
            'currency' => ['nullable', 'string', 'max:10'],
            'notes' => ['nullable', 'string'],
        ]);

        $payrollMonth = (string) $data['payroll_month'];
        $monthStart = Carbon::createFromFormat('Y-m', $payrollMonth)->startOfMonth();
        $monthEnd = $monthStart->copy()->endOfMonth();

        $batch = DB::transaction(function () use ($data, $hospitalId, $request, $monthStart, $monthEnd, $payrollMonth) {
            $existingBatch = PayrollBatch::query()
                ->where('hospital_id', $hospitalId)
                ->where('payroll_month', $payrollMonth)
                ->first();

            if ($existingBatch && in_array($existingBatch->status, ['approved', 'posted'], true)) {
                abort(422, 'Approved/posted payroll batch already exists for this month.');
            }

            if ($existingBatch && $existingBatch->status === 'voided') {
                abort(422, 'Voided payroll batch exists for this month. Create payroll for a new month.');
            }

            $batch = $existingBatch ?: PayrollBatch::create([
                'hospital_id' => $hospitalId,
                'payroll_month' => $payrollMonth,
                'status' => 'draft',
                'currency' => $data['currency'] ?? 'AFN',
                'notes' => $data['notes'] ?? null,
                'created_by' => $request->user()->name ?? null,
                'updated_by' => $request->user()->name ?? null,
            ]);

            if ($batch->status === 'generated') {
                abort(422, 'Payroll for this month has already been generated.');
            }

            PayrollItem::withTrashed()->where('payroll_batch_id', $batch->id)->forceDelete();

            $employees = Employee::query()
                ->where('hospital_id', $hospitalId)
                ->where('status', 'active')
                ->whereDate('joining_date', '<=', $monthEnd->toDateString())
                ->when(
                    !empty($data['employee_ids']),
                    fn ($q) => $q->whereIn('id', array_map('intval', (array) $data['employee_ids']))
                )
                ->orderBy('id')
                ->get();

            if ($employees->isEmpty()) {
                throw ValidationException::withMessages([
                    'employee_ids' => ['No eligible employees found for payroll generation.'],
                ]);
            }

            $employeeIds = $employees->pluck('id')->map(fn ($id) => (int) $id)->all();

            // Preload latest effective active salary structure per employee for the month.
            $salaryStructures = SalaryStructure::query()
                ->where('hospital_id', $hospitalId)
                ->whereIn('employee_id', $employeeIds)
                ->where('status', 'active')
                ->whereDate('effective_from', '<=', $monthEnd->toDateString())
                ->where(function ($q) use ($monthStart) {
                    $q->whereNull('effective_to')->orWhereDate('effective_to', '>=', $monthStart->toDateString());
                })
                ->orderBy('employee_id')
                ->orderByDesc('effective_from')
                ->orderByDesc('id')
                ->get();

            $salaryStructureByEmployee = [];
            foreach ($salaryStructures as $salaryStructure) {
                $employeeId = (int) $salaryStructure->employee_id;
                if (!array_key_exists($employeeId, $salaryStructureByEmployee)) {
                    $salaryStructureByEmployee[$employeeId] = $salaryStructure;
                }
            }

            // Aggregate attendance days in one query instead of querying per employee.
            $attendanceRows = EmployeeAttendance::query()
                ->select('employee_id', DB::raw("SUM(CASE WHEN status IN ('present','holiday') THEN 1 WHEN status = 'half_day' THEN 0.5 ELSE 0 END) AS attendance_days"))
                ->where('hospital_id', $hospitalId)
                ->whereIn('employee_id', $employeeIds)
                ->whereDate('attendance_date', '>=', $monthStart->toDateString())
                ->whereDate('attendance_date', '<=', $monthEnd->toDateString())
                ->groupBy('employee_id')
                ->pluck('attendance_days', 'employee_id');

            $attendanceByEmployee = [];
            foreach ($attendanceRows as $employeeId => $attendanceDays) {
                $attendanceByEmployee[(int) $employeeId] = (float) $attendanceDays;
            }

            // Load all approved overlapping leave requests once, then compute clipped days per employee.
            $approvedLeaves = LeaveRequest::query()
                ->where('hospital_id', $hospitalId)
                ->whereIn('employee_id', $employeeIds)
                ->where('status', 'approved')
                ->whereDate('start_date', '<=', $monthEnd->toDateString())
                ->whereDate('end_date', '>=', $monthStart->toDateString())
                ->get(['employee_id', 'start_date', 'end_date']);

            $approvedLeaveDaysByEmployee = [];
            foreach ($approvedLeaves as $leaveRequest) {
                $employeeId = (int) $leaveRequest->employee_id;

                $start = Carbon::parse($leaveRequest->start_date)->startOfDay();
                $end = Carbon::parse($leaveRequest->end_date)->startOfDay();

                if ($start->lt($monthStart)) {
                    $start = $monthStart->copy();
                }

                if ($end->gt($monthEnd)) {
                    $end = $monthEnd->copy();
                }

                if ($end->gte($start)) {
                    $approvedLeaveDaysByEmployee[$employeeId] = ($approvedLeaveDaysByEmployee[$employeeId] ?? 0.0)
                        + ($start->diffInDays($end) + 1);
                }
            }

            $daysInMonth = (float) $monthEnd->day;
            $monthToken = str_replace('-', '', $payrollMonth);

            $totalEmployees = 0;
            $grossAmount = 0.0;
            $deductionsAmount = 0.0;
            $netAmount = 0.0;

            foreach ($employees as $employee) {
                $employeeId = (int) $employee->id;
                $salaryStructure = $salaryStructureByEmployee[$employeeId] ?? null;

                $baseSalary = (float) ($salaryStructure?->base_salary ?? $employee->basic_salary ?? 0);
                $allowancesTotal = (float) ($salaryStructure?->allowances_total ?? 0);
                $deductionsTotal = (float) ($salaryStructure?->deductions_total ?? 0);

                $attendanceDays = $attendanceByEmployee[$employeeId] ?? 0.0;
                $approvedLeaveDays = $approvedLeaveDaysByEmployee[$employeeId] ?? 0.0;

                $payableDays = $attendanceDays + $approvedLeaveDays;
                if ($attendanceDays === 0.0 && $approvedLeaveDays === 0.0) {
                    // If no attendance/leave records exist, default to full-month payability.
                    $payableDays = $daysInMonth;
                }

                $payableDays = min($daysInMonth, max(0.0, $payableDays));

                $dailyRate = $daysInMonth > 0 ? ($baseSalary / $daysInMonth) : 0;
                $proratedBase = round($dailyRate * $payableDays, 2);
                $overtimeAmount = 0.0;
                $adjustmentsAmount = 0.0;
                $finalAmount = round($proratedBase + $allowancesTotal - $deductionsTotal + $overtimeAmount + $adjustmentsAmount, 2);

                $item = PayrollItem::create([
                    'hospital_id' => $hospitalId,
                    'payroll_batch_id' => $batch->id,
                    'employee_id' => $employeeId,
                    'salary_structure_id' => $salaryStructure?->id,
                    'slip_number' => sprintf('PAY-%s-%05d', $monthToken, $employeeId),
                    'base_salary' => $proratedBase,
                    'allowances_total' => $allowancesTotal,
                    'deductions_total' => $deductionsTotal,
                    'attendance_days' => round($attendanceDays, 2),
                    'payable_days' => round($payableDays, 2),
                    'overtime_amount' => $overtimeAmount,
                    'adjustments_amount' => $adjustmentsAmount,
                    'final_amount' => $finalAmount,
                    'status' => 'pending',
                    'created_by' => $request->user()->name ?? null,
                    'updated_by' => $request->user()->name ?? null,
                ]);

                $totalEmployees++;
                $grossAmount += (float) $item->base_salary + (float) $item->allowances_total;
                $deductionsAmount += (float) $item->deductions_total;
                $netAmount += (float) $item->final_amount;
            }

            $batch->update([
                'status' => 'generated',
                'total_employees' => $totalEmployees,
                'gross_amount' => round($grossAmount, 2),
                'deductions_amount' => round($deductionsAmount, 2),
                'net_amount' => round($netAmount, 2),
                'currency' => $data['currency'] ?? $batch->currency ?? 'AFN',
                'notes' => $data['notes'] ?? $batch->notes,
                'generated_by' => $request->user()->name ?? null,
                'generated_at' => now(),
                'approved_by' => null,
                'approved_at' => null,
                'posted_by' => null,
                'posted_at' => null,
                'updated_by' => $request->user()->name ?? null,
            ]);

            return $batch;
        });

        return response()->json($batch->fresh()->load(['items.employee:id,employee_code,first_name,last_name']));
    }

    public function approve(Request $request, PayrollBatch $payrollBatch)
    {
        $this->authorizeScope($request->user(), $payrollBatch);

        if ($payrollBatch->status !== 'generated') {
            abort(422, 'Only generated payroll batches can be approved.');
        }

        if (!$payrollBatch->items()->exists()) {
            abort(422, 'Payroll batch has no items to approve.');
        }

        DB::transaction(function () use ($payrollBatch, $request) {
            PayrollItem::query()
                ->where('payroll_batch_id', $payrollBatch->id)
                ->whereIn('status', ['pending', 'approved'])
                ->update([
                    'status' => 'approved',
                    'updated_by' => $request->user()->name ?? null,
                    'updated_at' => now(),
                ]);

            $payrollBatch->update([
                'status' => 'approved',
                'approved_by' => $request->user()->name ?? null,
                'approved_at' => now(),
                'updated_by' => $request->user()->name ?? null,
            ]);
        });

        return response()->json($payrollBatch->fresh()->load(['items.employee:id,employee_code,first_name,last_name']));
    }

    public function post(Request $request, PayrollBatch $payrollBatch)
    {
        $this->authorizeScope($request->user(), $payrollBatch);

        if ($payrollBatch->status !== 'approved') {
            abort(422, 'Only approved payroll batches can be posted.');
        }

        $data = $request->validate([
            'payment_method' => ['nullable', 'string', 'max:50'],
        ]);

        DB::transaction(function () use ($payrollBatch, $request, $data) {
            $items = PayrollItem::query()
                ->where('payroll_batch_id', $payrollBatch->id)
                ->get();

            foreach ($items as $item) {
                $item->update([
                    'status' => 'paid',
                    'paid_at' => now()->toDateString(),
                    'payment_method' => $data['payment_method'] ?? $item->payment_method,
                    'updated_by' => $request->user()->name ?? null,
                ]);

                $this->ledgerPostingService->upsertPayrollItemSnapshot($payrollBatch, $item->fresh());
            }

            $payrollBatch->update([
                'status' => 'posted',
                'posted_by' => $request->user()->name ?? null,
                'posted_at' => now(),
                'updated_by' => $request->user()->name ?? null,
            ]);
        });

        return response()->json($payrollBatch->fresh()->load(['items.employee:id,employee_code,first_name,last_name']));
    }

    public function void(Request $request, PayrollBatch $payrollBatch)
    {
        $this->authorizeScope($request->user(), $payrollBatch);

        if ($payrollBatch->status === 'voided') {
            return response()->json($payrollBatch->load(['items.employee:id,employee_code,first_name,last_name']));
        }

        DB::transaction(function () use ($payrollBatch, $request) {
            $items = PayrollItem::query()->where('payroll_batch_id', $payrollBatch->id)->get();

            foreach ($items as $item) {
                if ($payrollBatch->status === 'posted') {
                    $this->ledgerPostingService->voidPayrollItemSnapshot($item, $request->user()->name ?? null);
                }

                $item->update([
                    'status' => 'voided',
                    'updated_by' => $request->user()->name ?? null,
                ]);
            }

            $payrollBatch->update([
                'status' => 'voided',
                'updated_by' => $request->user()->name ?? null,
            ]);
        });

        return response()->json($payrollBatch->fresh()->load(['items.employee:id,employee_code,first_name,last_name']));
    }

    public function destroy(Request $request, PayrollBatch $payrollBatch)
    {
        $this->authorizeScope($request->user(), $payrollBatch);

        if ($payrollBatch->status === 'posted') {
            abort(422, 'Posted payroll batches cannot be deleted. Void them instead.');
        }

        DB::transaction(function () use ($payrollBatch) {
            PayrollItem::withTrashed()->where('payroll_batch_id', $payrollBatch->id)->forceDelete();
            $payrollBatch->forceDelete();
        });

        return response()->json(['message' => 'Payroll batch deleted']);
    }

    private function validateStorePayload(Request $request, int $hospitalId): array
    {
        return $request->validate([
            'hospital_id' => ['required', 'exists:hospitals,id'],
            'payroll_month' => ['required', 'regex:/^\d{4}-(0[1-9]|1[0-2])$/'],
            'currency' => ['nullable', 'string', 'max:10'],
            'notes' => ['nullable', 'string'],
        ]);
    }

    private function calculateAttendanceDays(int $employeeId, Carbon $monthStart, Carbon $monthEnd): float
    {
        $records = EmployeeAttendance::query()
            ->where('employee_id', $employeeId)
            ->whereDate('attendance_date', '>=', $monthStart->toDateString())
            ->whereDate('attendance_date', '<=', $monthEnd->toDateString())
            ->get(['status']);

        $days = 0.0;

        foreach ($records as $record) {
            $status = strtolower((string) $record->status);
            if ($status === 'present' || $status === 'holiday') {
                $days += 1;
            } elseif ($status === 'half_day') {
                $days += 0.5;
            }
        }

        return $days;
    }

    private function calculateApprovedLeaveDays(int $employeeId, Carbon $monthStart, Carbon $monthEnd): float
    {
        $leaveRequests = LeaveRequest::query()
            ->where('employee_id', $employeeId)
            ->where('status', 'approved')
            ->whereDate('start_date', '<=', $monthEnd->toDateString())
            ->whereDate('end_date', '>=', $monthStart->toDateString())
            ->get(['start_date', 'end_date']);

        $days = 0.0;

        foreach ($leaveRequests as $leaveRequest) {
            $start = Carbon::parse($leaveRequest->start_date)->startOfDay();
            $end = Carbon::parse($leaveRequest->end_date)->startOfDay();

            if ($start->lt($monthStart)) {
                $start = $monthStart->copy();
            }

            if ($end->gt($monthEnd)) {
                $end = $monthEnd->copy();
            }

            if ($end->gte($start)) {
                $days += $start->diffInDays($end) + 1;
            }
        }

        return $days;
    }

    private function resolveHospitalId(Request $request, ?int $fallbackHospitalId = null): int
    {
        if ($request->user()->role !== 'super_admin') {
            $tenantHospitalId = (int) ($fallbackHospitalId ?: $request->user()->hospital_id);

            if ($tenantHospitalId <= 0) {
                abort(422, 'Hospital tenant context is required for this user.');
            }

            return $tenantHospitalId;
        }

        $hospitalId = $request->integer('hospital_id') ?: $fallbackHospitalId;

        if (!$hospitalId) {
            abort(422, 'The hospital_id field is required.');
        }

        return (int) $hospitalId;
    }

    private function authorizeScope($user, PayrollBatch $payrollBatch): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $payrollBatch->hospital_id) {
            abort(403, 'Unauthorized payroll batch access');
        }
    }
}
