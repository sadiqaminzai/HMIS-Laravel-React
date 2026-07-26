<?php

namespace App\Http\Controllers;

use App\Models\PayrollBatch;
use App\Models\PayrollItem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class PayrollItemController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = PayrollItem::query()->with([
            'batch:id,payroll_month,status,currency',
            'employee:id,employee_code,first_name,last_name',
        ]);

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('payroll_batch_id')) {
            $query->where('payroll_batch_id', $request->integer('payroll_batch_id'));
        }

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->integer('employee_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        return response()->json($query->orderByDesc('id')->get());
    }

    public function show(Request $request, PayrollItem $payrollItem)
    {
        $this->authorizeScope($request->user(), $payrollItem);

        return response()->json($payrollItem->load([
            'batch:id,payroll_month,status,currency',
            'employee:id,employee_code,first_name,last_name',
            'salaryStructure:id,effective_from,effective_to,base_salary,allowances_total,deductions_total,net_salary,currency,status',
            'salaryStructure.components',
        ]));
    }

    public function update(Request $request, PayrollItem $payrollItem)
    {
        $this->authorizeScope($request->user(), $payrollItem);

        $payrollItem->loadMissing('batch');
        $this->ensureBatchEditable($payrollItem);

        if ($request->has('status')) {
            throw ValidationException::withMessages([
                'status' => ['Payroll item status can only be changed via payroll batch actions (approve, post, void).'],
            ]);
        }

        $data = $request->validate([
            'allowances_total' => ['nullable', 'numeric', 'min:0'],
            'deductions_total' => ['nullable', 'numeric', 'min:0'],
            'attendance_days' => ['nullable', 'numeric', 'min:0'],
            'payable_days' => ['nullable', 'numeric', 'min:0'],
            'overtime_amount' => ['nullable', 'numeric', 'min:0'],
            'adjustments_amount' => ['nullable', 'numeric'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
        ]);

        $baseSalary = (float) $payrollItem->base_salary;
        $allowances = array_key_exists('allowances_total', $data)
            ? (float) $data['allowances_total']
            : (float) $payrollItem->allowances_total;
        $deductions = array_key_exists('deductions_total', $data)
            ? (float) $data['deductions_total']
            : (float) $payrollItem->deductions_total;
        $overtime = array_key_exists('overtime_amount', $data)
            ? (float) $data['overtime_amount']
            : (float) $payrollItem->overtime_amount;
        $adjustments = array_key_exists('adjustments_amount', $data)
            ? (float) $data['adjustments_amount']
            : (float) $payrollItem->adjustments_amount;

        $finalAmount = round($baseSalary + $allowances - $deductions + $overtime + $adjustments, 2);

        DB::transaction(function () use ($payrollItem, $data, $finalAmount, $request) {
            $payrollItem->update(array_merge($data, [
                'final_amount' => $finalAmount,
                'updated_by' => $request->user()->name ?? null,
            ]));

            $this->syncBatchTotals((int) $payrollItem->payroll_batch_id, $request->user()->name ?? null);
        });

        return response()->json($payrollItem->fresh()->load([
            'batch:id,payroll_month,status,currency',
            'employee:id,employee_code,first_name,last_name',
            'salaryStructure.components',
        ]));
    }

    public function payslip(Request $request, PayrollItem $payrollItem)
    {
        $this->authorizeScope($request->user(), $payrollItem);

        $payrollItem->load([
            'batch:id,payroll_month,status,currency,generated_at,approved_at,posted_at',
            'employee:id,employee_code,first_name,last_name,joining_date,department_id,designation_id',
            'employee.department:id,name',
            'employee.designation:id,name',
            'salaryStructure.components',
        ]);

        return response()->json([
            'id' => $payrollItem->id,
            'slip_number' => $payrollItem->slip_number,
            'status' => $payrollItem->status,
            'payment_method' => $payrollItem->payment_method,
            'paid_at' => $payrollItem->paid_at,
            'employee' => $payrollItem->employee,
            'batch' => $payrollItem->batch,
            'salary_structure' => $payrollItem->salaryStructure,
            'breakdown' => [
                'base_salary' => (float) $payrollItem->base_salary,
                'allowances_total' => (float) $payrollItem->allowances_total,
                'deductions_total' => (float) $payrollItem->deductions_total,
                'overtime_amount' => (float) $payrollItem->overtime_amount,
                'adjustments_amount' => (float) $payrollItem->adjustments_amount,
                'attendance_days' => (float) $payrollItem->attendance_days,
                'payable_days' => (float) $payrollItem->payable_days,
                'final_amount' => (float) $payrollItem->final_amount,
            ],
            'notes' => $payrollItem->notes,
        ]);
    }

    public function destroy(Request $request, PayrollItem $payrollItem)
    {
        $this->authorizeScope($request->user(), $payrollItem);

        $payrollItem->loadMissing('batch');
        $this->ensureBatchEditable($payrollItem);

        DB::transaction(function () use ($payrollItem, $request) {
            $batchId = (int) $payrollItem->payroll_batch_id;
            $payrollItem->forceDelete();
            $this->syncBatchTotals($batchId, $request->user()->name ?? null);
        });

        return response()->json(['message' => 'Payroll item deleted']);
    }

    private function syncBatchTotals(int $batchId, ?string $actor = null): void
    {
        $totals = PayrollItem::query()
            ->where('payroll_batch_id', $batchId)
            ->selectRaw('COUNT(*) as total_employees')
            ->selectRaw('COALESCE(SUM(base_salary + allowances_total), 0) as gross_amount')
            ->selectRaw('COALESCE(SUM(deductions_total), 0) as deductions_amount')
            ->selectRaw('COALESCE(SUM(final_amount), 0) as net_amount')
            ->first();

        PayrollBatch::query()
            ->whereKey($batchId)
            ->update([
                'total_employees' => (int) ($totals->total_employees ?? 0),
                'gross_amount' => round((float) ($totals->gross_amount ?? 0), 2),
                'deductions_amount' => round((float) ($totals->deductions_amount ?? 0), 2),
                'net_amount' => round((float) ($totals->net_amount ?? 0), 2),
                'updated_by' => $actor,
            ]);
    }

    private function ensureBatchEditable(PayrollItem $payrollItem): void
    {
        $batchStatus = strtolower((string) ($payrollItem->batch?->status ?? ''));

        if (in_array($batchStatus, ['posted', 'voided'], true)) {
            abort(422, 'Payroll items in posted/voided batches cannot be edited.');
        }
    }

    private function authorizeScope($user, PayrollItem $payrollItem): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $payrollItem->hospital_id) {
            abort(403, 'Unauthorized payroll item access');
        }
    }
}
