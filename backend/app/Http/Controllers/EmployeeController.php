<?php

namespace App\Http\Controllers;

use App\Models\Designation;
use App\Models\Employee;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class EmployeeController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Employee::query()->with([
            'department:id,name',
            'designation:id,name',
            'shift:id,name,start_time,end_time',
            'user:id,name,email',
        ]);

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('department_id')) {
            $query->where('department_id', $request->integer('department_id'));
        }

        if ($request->filled('designation_id')) {
            $query->where('designation_id', $request->integer('designation_id'));
        }

        if ($request->filled('employment_type')) {
            $query->where('employment_type', $request->string('employment_type'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('employee_code', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        return response()->json($query->orderByDesc('id')->get());
    }

    public function store(Request $request)
    {
        $hospitalId = $this->resolveHospitalId($request);
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $this->validatePayload($request, null, $hospitalId);
        $this->validateDepartmentDesignationConsistency($data, $hospitalId);

        $data['hospital_id'] = $hospitalId;
        $data['employee_code'] = $data['employee_code'] ?? null;
        $data['created_by'] = $request->user()->name ?? null;
        $data['updated_by'] = $request->user()->name ?? null;

        if ($request->hasFile('profile_image')) {
            $data['profile_image_path'] = $request->file('profile_image')->store('employees/profile', 'public');
        }

        if ($request->hasFile('contract_document')) {
            $data['contract_document_path'] = $request->file('contract_document')->store('employees/documents', 'public');
        }

        $employee = Employee::create($data);

        return response()->json($employee->load(['department:id,name', 'designation:id,name', 'shift:id,name,start_time,end_time', 'user:id,name,email']), 201);
    }

    public function show(Request $request, Employee $employee)
    {
        $this->authorizeScope($request->user(), $employee);

        return response()->json($employee->load(['department:id,name', 'designation:id,name', 'shift:id,name,start_time,end_time', 'user:id,name,email']));
    }

    public function update(Request $request, Employee $employee)
    {
        $this->authorizeScope($request->user(), $employee);

        $hospitalId = (int) $employee->hospital_id;
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $this->validatePayload($request, $employee->id, $hospitalId);
        $this->validateDepartmentDesignationConsistency($data, $hospitalId);

        $data['hospital_id'] = $hospitalId;
        $data['employee_code'] = $data['employee_code'] ?? $employee->employee_code;
        $data['updated_by'] = $request->user()->name ?? null;

        if ($request->hasFile('profile_image')) {
            if ($employee->profile_image_path) {
                Storage::disk('public')->delete($employee->profile_image_path);
            }
            $data['profile_image_path'] = $request->file('profile_image')->store('employees/profile', 'public');
        }

        if ($request->hasFile('contract_document')) {
            if ($employee->contract_document_path) {
                Storage::disk('public')->delete($employee->contract_document_path);
            }
            $data['contract_document_path'] = $request->file('contract_document')->store('employees/documents', 'public');
        }

        $employee->update($data);

        return response()->json($employee->fresh()->load(['department:id,name', 'designation:id,name', 'shift:id,name,start_time,end_time', 'user:id,name,email']));
    }

    public function destroy(Request $request, Employee $employee)
    {
        $this->authorizeScope($request->user(), $employee);

        $employee->delete();

        return response()->json(['message' => 'Employee deleted']);
    }

    private function validatePayload(Request $request, ?int $employeeId = null, ?int $defaultHospitalId = null): array
    {
        $hospitalId = $defaultHospitalId ?: $this->resolveHospitalId($request);

        return $request->validate([
            'hospital_id' => ['required', 'exists:hospitals,id'],
            'user_id' => [
                'nullable',
                Rule::exists('users', 'id')->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
            ],
            'department_id' => [
                'nullable',
                Rule::exists('departments', 'id')->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
            ],
            'designation_id' => [
                'nullable',
                Rule::exists('designations', 'id')->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
            ],
            'shift_id' => [
                'nullable',
                Rule::exists('shifts', 'id')->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
            ],
            'employee_code' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('employees', 'employee_code')
                    ->ignore($employeeId)
                    ->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
            ],
            'first_name' => ['required', 'string', 'max:100'],
            'last_name' => ['required', 'string', 'max:100'],
            'gender' => ['required', 'in:male,female,other'],
            'date_of_birth' => ['nullable', 'date', 'before_or_equal:today'],
            'phone' => ['nullable', 'string', 'max:50'],
            'email' => [
                'nullable',
                'email',
                'max:191',
                Rule::unique('employees', 'email')
                    ->ignore($employeeId)
                    ->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
            ],
            'address' => ['nullable', 'string'],
            'emergency_contact_name' => ['nullable', 'string', 'max:191'],
            'emergency_contact_phone' => ['nullable', 'string', 'max:50'],
            'joining_date' => ['required', 'date'],
            'employment_type' => ['required', 'in:permanent,contract,temporary,intern'],
            'basic_salary' => ['required', 'numeric', 'min:0'],
            'status' => ['required', 'in:active,inactive,terminated'],
            'profile_image' => ['nullable', 'image', 'max:2048'],
            'contract_document' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:4096'],
        ]);
    }

    private function validateDepartmentDesignationConsistency(array $data, int $hospitalId): void
    {
        if (empty($data['designation_id']) || empty($data['department_id'])) {
            return;
        }

        $matchesDepartment = Designation::query()
            ->where('hospital_id', $hospitalId)
            ->where('id', $data['designation_id'])
            ->where('department_id', $data['department_id'])
            ->exists();

        if (!$matchesDepartment) {
            throw ValidationException::withMessages([
                'designation_id' => ['Selected designation does not belong to the selected department.'],
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

    private function authorizeScope($user, Employee $employee): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $employee->hospital_id) {
            abort(403, 'Unauthorized employee access');
        }
    }
}
