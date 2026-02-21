<?php

namespace App\Http\Controllers;

use App\Models\MedicineType;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class MedicineTypeController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = MedicineType::query();

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
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
        $this->authorizeMedicineTypeAction($request->user(), 'add_medicine_types');

        $data = $this->validatePayload($request);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        }

        $medicineType = MedicineType::create($data);

        return response()->json($medicineType, 201);
    }

    public function show(Request $request, MedicineType $medicineType)
    {
        $this->authorizeScope($request->user(), $medicineType);

        return response()->json($medicineType);
    }

    public function update(Request $request, MedicineType $medicineType)
    {
        $this->authorizeMedicineTypeAction($request->user(), 'edit_medicine_types');
        $this->authorizeScope($request->user(), $medicineType);

        $data = $this->validatePayload($request, $medicineType->id, $medicineType->hospital_id);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $medicineType->hospital_id;
        }

        $medicineType->update($data);

        return response()->json($medicineType->fresh());
    }

    public function destroy(Request $request, MedicineType $medicineType)
    {
        $this->authorizeMedicineTypeAction($request->user(), 'delete_medicine_types');
        $this->authorizeScope($request->user(), $medicineType);

        $medicineType->delete();

        return response()->json(['message' => 'Medicine type deleted']);
    }

    private function validatePayload(Request $request, ?int $medicineTypeId = null, ?int $defaultHospitalId = null): array
    {
        $hospitalId = $request->integer('hospital_id') ?: $defaultHospitalId ?: $request->user()->hospital_id;

        return $request->validate([
            'hospital_id' => [$request->user()->role === 'super_admin' ? 'required' : 'sometimes', 'exists:hospitals,id'],
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('medicine_types', 'name')
                    ->ignore($medicineTypeId)
                    ->where(fn ($q) => $hospitalId ? $q->where('hospital_id', $hospitalId) : $q),
            ],
            'description' => ['nullable', 'string'],
            'status' => ['required', 'in:active,inactive'],
        ]);
    }

    private function authorizeMedicineTypeAction($user, string $permission): void
    {
        $this->ensureAnyPermission(
            $user,
            [$permission, 'manage_medicine_types'],
            'Only users with medicine type permissions can manage medicine types'
        );
    }

    private function authorizeScope($user, MedicineType $medicineType): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $medicineType->hospital_id) {
            abort(403, 'Unauthorized medicine type access');
        }
    }
}
