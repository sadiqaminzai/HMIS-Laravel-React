<?php

namespace App\Http\Controllers;

use App\Models\SalaryComponent;
use App\Models\SalaryStructure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SalaryStructureController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = SalaryStructure::query()->with([
            'employee:id,employee_code,first_name,last_name',
            'components',
        ]);

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->integer('employee_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('effective_on')) {
            $effectiveOn = $request->string('effective_on');
            $query
                ->whereDate('effective_from', '<=', $effectiveOn)
                ->where(function ($q) use ($effectiveOn) {
                    $q->whereNull('effective_to')->orWhereDate('effective_to', '>=', $effectiveOn);
                });
        }

        return response()->json($query->orderByDesc('effective_from')->orderByDesc('id')->get());
    }

    public function store(Request $request)
    {
        $hospitalId = $this->resolveHospitalId($request);
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $this->validatePayload($request, null, $hospitalId);
        $this->ensureNoOverlap((int) $data['employee_id'], (string) $data['effective_from'], $data['effective_to'] ?? null);

        $record = DB::transaction(function () use ($data, $hospitalId, $request) {
            [$structureData, $componentsData] = $this->splitPayload($data);
            [$allowancesTotal, $deductionsTotal] = $this->resolveTotals($structureData, $componentsData, null);

            $structureData['hospital_id'] = $hospitalId;
            $structureData['allowances_total'] = $allowancesTotal;
            $structureData['deductions_total'] = $deductionsTotal;
            $structureData['net_salary'] = (float) $structureData['base_salary'] + $allowancesTotal - $deductionsTotal;
            $structureData['created_by'] = $request->user()->name ?? null;
            $structureData['updated_by'] = $request->user()->name ?? null;

            $salaryStructure = SalaryStructure::create($structureData);

            foreach ($componentsData as $component) {
                SalaryComponent::create([
                    'hospital_id' => $hospitalId,
                    'salary_structure_id' => $salaryStructure->id,
                    'component_type' => $component['component_type'],
                    'name' => $component['name'],
                    'amount' => $component['amount'],
                    'is_taxable' => (bool) ($component['is_taxable'] ?? false),
                    'sort_order' => (int) ($component['sort_order'] ?? 0),
                ]);
            }

            return $salaryStructure;
        });

        return response()->json($record->load(['employee:id,employee_code,first_name,last_name', 'components']), 201);
    }

    public function show(Request $request, SalaryStructure $salaryStructure)
    {
        $this->authorizeScope($request->user(), $salaryStructure);

        return response()->json($salaryStructure->load(['employee:id,employee_code,first_name,last_name', 'components']));
    }

    public function update(Request $request, SalaryStructure $salaryStructure)
    {
        $this->authorizeScope($request->user(), $salaryStructure);

        $hospitalId = (int) $salaryStructure->hospital_id;
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $this->validatePayload($request, $salaryStructure->id, $hospitalId);
        $this->ensureNoOverlap((int) $data['employee_id'], (string) $data['effective_from'], $data['effective_to'] ?? null, $salaryStructure->id);

        $updated = DB::transaction(function () use ($data, $salaryStructure, $hospitalId, $request) {
            [$structureData, $componentsData] = $this->splitPayload($data);
            [$allowancesTotal, $deductionsTotal] = $this->resolveTotals($structureData, $componentsData, $salaryStructure);

            $structureData['hospital_id'] = $hospitalId;
            $structureData['allowances_total'] = $allowancesTotal;
            $structureData['deductions_total'] = $deductionsTotal;
            $structureData['net_salary'] = (float) $structureData['base_salary'] + $allowancesTotal - $deductionsTotal;
            $structureData['updated_by'] = $request->user()->name ?? null;

            $salaryStructure->update($structureData);

            if ($componentsData !== null) {
                SalaryComponent::query()->where('salary_structure_id', $salaryStructure->id)->delete();

                foreach ($componentsData as $component) {
                    SalaryComponent::create([
                        'hospital_id' => $hospitalId,
                        'salary_structure_id' => $salaryStructure->id,
                        'component_type' => $component['component_type'],
                        'name' => $component['name'],
                        'amount' => $component['amount'],
                        'is_taxable' => (bool) ($component['is_taxable'] ?? false),
                        'sort_order' => (int) ($component['sort_order'] ?? 0),
                    ]);
                }
            }

            return $salaryStructure;
        });

        return response()->json($updated->fresh()->load(['employee:id,employee_code,first_name,last_name', 'components']));
    }

    public function destroy(Request $request, SalaryStructure $salaryStructure)
    {
        $this->authorizeScope($request->user(), $salaryStructure);

        if (strtolower((string) $salaryStructure->status) === 'active') {
            abort(422, 'Active salary structures cannot be deleted. Set them inactive first.');
        }

        $salaryStructure->delete();

        return response()->json(['message' => 'Salary structure deleted']);
    }

    private function validatePayload(Request $request, ?int $salaryStructureId = null, ?int $defaultHospitalId = null): array
    {
        $hospitalId = $defaultHospitalId ?: $this->resolveHospitalId($request);

        return $request->validate([
            'hospital_id' => ['required', 'exists:hospitals,id'],
            'employee_id' => [
                'required',
                Rule::exists('employees', 'id')->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
            ],
            'effective_from' => ['required', 'date'],
            'effective_to' => ['nullable', 'date', 'after_or_equal:effective_from'],
            'base_salary' => ['required', 'numeric', 'min:0'],
            'allowances_total' => ['nullable', 'numeric', 'min:0'],
            'deductions_total' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:10'],
            'notes' => ['nullable', 'string'],
            'status' => ['required', 'in:active,inactive'],
            'components' => ['nullable', 'array'],
            'components.*.component_type' => ['required_with:components', 'in:allowance,deduction'],
            'components.*.name' => ['required_with:components', 'string', 'max:150'],
            'components.*.amount' => ['required_with:components', 'numeric', 'min:0'],
            'components.*.is_taxable' => ['nullable', 'boolean'],
            'components.*.sort_order' => ['nullable', 'integer', 'min:0'],
        ]);
    }

    private function splitPayload(array $data): array
    {
        $components = array_key_exists('components', $data) ? (array) ($data['components'] ?? []) : null;
        unset($data['components']);

        return [$data, $components];
    }

    private function resolveTotals(array $structureData, ?array $componentsData, ?SalaryStructure $existingStructure): array
    {
        if ($componentsData !== null) {
            $allowances = 0.0;
            $deductions = 0.0;

            foreach ($componentsData as $component) {
                $amount = (float) ($component['amount'] ?? 0);
                if (($component['component_type'] ?? '') === 'allowance') {
                    $allowances += $amount;
                } else {
                    $deductions += $amount;
                }
            }

            return [$allowances, $deductions];
        }

        $allowances = array_key_exists('allowances_total', $structureData)
            ? (float) ($structureData['allowances_total'] ?? 0)
            : (float) ($existingStructure?->allowances_total ?? 0);

        $deductions = array_key_exists('deductions_total', $structureData)
            ? (float) ($structureData['deductions_total'] ?? 0)
            : (float) ($existingStructure?->deductions_total ?? 0);

        return [$allowances, $deductions];
    }

    private function ensureNoOverlap(int $employeeId, string $effectiveFrom, ?string $effectiveTo = null, ?int $ignoreId = null): void
    {
        $query = SalaryStructure::query()
            ->where('employee_id', $employeeId)
            ->whereRaw('COALESCE(effective_to, ?) >= ?', ['9999-12-31', $effectiveFrom]);

        if ($effectiveTo) {
            $query->whereDate('effective_from', '<=', $effectiveTo);
        }

        if ($ignoreId) {
            $query->where('id', '!=', $ignoreId);
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'effective_from' => ['Salary structure dates overlap with an existing structure for this employee.'],
            ]);
        }
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

    private function authorizeScope($user, SalaryStructure $salaryStructure): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $salaryStructure->hospital_id) {
            abort(403, 'Unauthorized salary structure access');
        }
    }
}
