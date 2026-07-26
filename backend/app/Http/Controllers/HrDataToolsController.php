<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class HrDataToolsController extends Controller
{
    private const MODULES = [
        'shifts' => [
            'table' => 'shifts',
            'columns' => ['name', 'code', 'start_time', 'end_time', 'grace_minutes', 'status', 'description'],
            'unique' => ['hospital_id', 'name'],
            'sort' => ['name' => 'asc'],
        ],
        'departments' => [
            'table' => 'departments',
            'columns' => ['name', 'code', 'description', 'status'],
            'unique' => ['hospital_id', 'name'],
            'sort' => ['name' => 'asc'],
        ],
        'designations' => [
            'table' => 'designations',
            'columns' => ['department_id', 'name', 'description', 'status'],
            'unique' => ['hospital_id', 'name'],
            'sort' => ['name' => 'asc'],
        ],
        'employees' => [
            'table' => 'employees',
            'columns' => ['department_id', 'designation_id', 'shift_id', 'employee_code', 'first_name', 'last_name', 'gender', 'date_of_birth', 'phone', 'email', 'address', 'emergency_contact_name', 'emergency_contact_phone', 'joining_date', 'employment_type', 'basic_salary', 'status'],
            'unique' => ['hospital_id', 'employee_code'],
            'sort' => ['id' => 'desc'],
        ],
        'employee_attendances' => [
            'table' => 'employee_attendances',
            'columns' => ['employee_id', 'shift_id', 'attendance_date', 'check_in_time', 'check_out_time', 'status', 'notes'],
            'unique' => ['hospital_id', 'employee_id', 'attendance_date'],
            'sort' => ['attendance_date' => 'desc'],
        ],
        'leave_requests' => [
            'table' => 'leave_requests',
            'columns' => ['employee_id', 'leave_type', 'start_date', 'end_date', 'total_days', 'reason', 'status', 'rejection_reason'],
            'unique' => ['hospital_id', 'employee_id', 'start_date', 'end_date'],
            'sort' => ['start_date' => 'desc'],
        ],
        'salary_structures' => [
            'table' => 'salary_structures',
            'columns' => ['employee_id', 'effective_from', 'effective_to', 'base_salary', 'allowances_total', 'deductions_total', 'net_salary', 'currency', 'notes', 'status'],
            'unique' => ['hospital_id', 'employee_id', 'effective_from'],
            'sort' => ['effective_from' => 'desc'],
        ],
        'payroll_batches' => [
            'table' => 'payroll_batches',
            'columns' => ['payroll_month', 'status', 'total_employees', 'gross_amount', 'deductions_amount', 'net_amount', 'currency', 'notes'],
            'unique' => ['hospital_id', 'payroll_month'],
            'sort' => ['payroll_month' => 'desc'],
        ],
        'payroll_items' => [
            'table' => 'payroll_items',
            'columns' => ['payroll_batch_id', 'employee_id', 'salary_structure_id', 'slip_number', 'base_salary', 'allowances_total', 'deductions_total', 'attendance_days', 'payable_days', 'overtime_amount', 'adjustments_amount', 'final_amount', 'status', 'paid_at', 'payment_method', 'notes'],
            'unique' => ['hospital_id', 'payroll_batch_id', 'employee_id'],
            'sort' => ['id' => 'desc'],
        ],
    ];

    public function modules()
    {
        return response()->json([
            'modules' => array_keys(self::MODULES),
        ]);
    }

    public function export(Request $request, string $module)
    {
        $definition = $this->module($module);
        $hospitalId = $this->resolveHospitalId($request);

        $query = DB::table($definition['table'])
            ->where('hospital_id', $hospitalId)
            ->whereNull('deleted_at');

        foreach ($definition['sort'] as $column => $direction) {
            $query->orderBy($column, $direction);
        }

        $columns = array_merge(['hospital_id'], $definition['columns']);
        $filename = $module . '_export_' . now()->format('Ymd_His') . '.csv';

        return response()->streamDownload(function () use ($query, $columns) {
            $output = fopen('php://output', 'w');
            fputcsv($output, $columns);

            $query->chunk(500, function ($rows) use ($output, $columns) {
                foreach ($rows as $row) {
                    $line = [];
                    foreach ($columns as $column) {
                        $line[] = $row->{$column} ?? null;
                    }
                    fputcsv($output, $line);
                }
            });

            fclose($output);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    public function import(Request $request, string $module)
    {
        $definition = $this->module($module);
        $hospitalId = $this->resolveHospitalId($request);

        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt'],
        ]);

        $rows = $this->parseCsv((string) $request->file('file')->getRealPath());
        if (empty($rows)) {
            throw ValidationException::withMessages([
                'file' => ['No data rows found in import file.'],
            ]);
        }

        $allowedColumns = array_flip($definition['columns']);
        $upsertRows = [];

        foreach ($rows as $index => $row) {
            $mapped = [
                'hospital_id' => $hospitalId,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            foreach ($row as $key => $value) {
                if (!isset($allowedColumns[$key])) {
                    continue;
                }
                $mapped[$key] = $value === '' ? null : $value;
            }

            $this->validateRequiredColumns($module, $mapped, $index + 2);
            $upsertRows[] = $mapped;
        }

        DB::table($definition['table'])->upsert(
            $upsertRows,
            $definition['unique'],
            array_values(array_filter(array_keys($upsertRows[0] ?? []), fn ($col) => !in_array($col, ['hospital_id', 'created_at'], true)))
        );

        return response()->json([
            'message' => 'HR import completed.',
            'module' => $module,
            'count' => count($upsertRows),
        ]);
    }

    private function validateRequiredColumns(string $module, array $row, int $line): void
    {
        $requiredByModule = [
            'shifts' => ['name', 'start_time', 'end_time', 'status'],
            'departments' => ['name', 'status'],
            'designations' => ['name', 'status'],
            'employees' => ['first_name', 'last_name', 'gender', 'joining_date', 'employment_type', 'basic_salary', 'status'],
            'employee_attendances' => ['employee_id', 'attendance_date', 'status'],
            'leave_requests' => ['employee_id', 'leave_type', 'start_date', 'end_date', 'status'],
            'salary_structures' => ['employee_id', 'effective_from', 'base_salary', 'status'],
            'payroll_batches' => ['payroll_month', 'status', 'currency'],
            'payroll_items' => ['payroll_batch_id', 'employee_id', 'status'],
        ];

        $required = $requiredByModule[$module] ?? [];
        foreach ($required as $field) {
            if (!array_key_exists($field, $row) || $row[$field] === null || $row[$field] === '') {
                throw ValidationException::withMessages([
                    'file' => ["Line {$line}: {$field} is required."],
                ]);
            }
        }
    }

    private function parseCsv(string $path): array
    {
        $rows = [];

        if (($handle = fopen($path, 'r')) === false) {
            return $rows;
        }

        $headers = fgetcsv($handle);
        if (!$headers) {
            fclose($handle);
            return $rows;
        }

        $normalizedHeaders = array_map(fn ($h) => strtolower(trim((string) $h)), $headers);

        while (($line = fgetcsv($handle)) !== false) {
            if (count(array_filter($line, fn ($v) => trim((string) $v) !== '')) === 0) {
                continue;
            }

            $row = [];
            foreach ($normalizedHeaders as $idx => $header) {
                $row[$header] = isset($line[$idx]) ? trim((string) $line[$idx]) : null;
            }
            $rows[] = $row;
        }

        fclose($handle);

        return $rows;
    }

    private function module(string $module): array
    {
        if (!isset(self::MODULES[$module])) {
            abort(404, 'Unsupported HR module.');
        }

        return self::MODULES[$module];
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
}
