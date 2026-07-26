<?php

namespace App\Http\Controllers;

use App\Models\Designation;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DesignationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Designation::query()->with('department:id,name');

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('department_id')) {
            $query->where('department_id', $request->integer('department_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        return response()->json($query->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $hospitalId = $this->resolveHospitalId($request);
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $this->validatePayload($request, null, $hospitalId);
        $data['hospital_id'] = $hospitalId;
        $data['created_by'] = $request->user()->name ?? null;
        $data['updated_by'] = $request->user()->name ?? null;

        $designation = Designation::create($data);

        return response()->json($designation->load('department:id,name'), 201);
    }

    public function show(Request $request, Designation $designation)
    {
        $this->authorizeScope($request->user(), $designation);

        return response()->json($designation->load('department:id,name'));
    }

    public function update(Request $request, Designation $designation)
    {
        $this->authorizeScope($request->user(), $designation);

        $hospitalId = (int) $designation->hospital_id;
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $this->validatePayload($request, $designation->id, $hospitalId);
        $data['hospital_id'] = $hospitalId;
        $data['updated_by'] = $request->user()->name ?? null;

        $designation->update($data);

        return response()->json($designation->fresh()->load('department:id,name'));
    }

    public function destroy(Request $request, Designation $designation)
    {
        $this->authorizeScope($request->user(), $designation);

        $designation->delete();

        return response()->json(['message' => 'Designation deleted']);
    }

    private function validatePayload(Request $request, ?int $designationId = null, ?int $defaultHospitalId = null): array
    {
        $hospitalId = $defaultHospitalId ?: $this->resolveHospitalId($request);

        return $request->validate([
            'hospital_id' => ['required', 'exists:hospitals,id'],
            'department_id' => [
                'nullable',
                Rule::exists('departments', 'id')
                    ->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
            ],
            'name' => [
                'required',
                'string',
                'max:150',
                Rule::unique('designations', 'name')
                    ->ignore($designationId)
                    ->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
            ],
            'description' => ['nullable', 'string'],
            'status' => ['required', 'in:active,inactive'],
        ]);
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

    private function authorizeScope($user, Designation $designation): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $designation->hospital_id) {
            abort(403, 'Unauthorized designation access');
        }
    }
}
