<?php

namespace App\Http\Controllers;

use App\Models\Manufacturer;
use App\Models\Medicine;
use App\Models\MedicineType;
use Illuminate\Http\Request;

class MedicineController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Medicine::with(['manufacturer:id,name,hospital_id', 'medicineType:id,name,hospital_id']);

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('manufacturer_id')) {
            $query->where('manufacturer_id', $request->integer('manufacturer_id'));
        }

        if ($request->filled('medicine_type_id')) {
            $query->where('medicine_type_id', $request->integer('medicine_type_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('brand_name', 'like', "%{$search}%")
                    ->orWhere('generic_name', 'like', "%{$search}%")
                    ->orWhere('strength', 'like', "%{$search}%")
                    ->orWhere('barcode', 'like', "%{$search}%");
            });
        }

        if ($request->filled('barcode')) {
            $query->where('barcode', $request->string('barcode'));
        }

        $perPage = max(1, min($request->integer('per_page', 25), 200));

        return response()->json(
            $query->orderBy('brand_name')->paginate($perPage)
        );
    }

    public function store(Request $request)
    {
        $this->authorizeMedicineAction($request->user(), 'add_medicines');

        $data = $this->validatePayload($request);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        }

        $this->ensureHospitalConsistency($data);

        $medicine = Medicine::create($data);

        return response()->json($medicine->load(['manufacturer', 'medicineType']), 201);
    }

    public function show(Request $request, Medicine $medicine)
    {
        $this->authorizeScope($request->user(), $medicine);

        return response()->json($medicine->load(['manufacturer', 'medicineType']));
    }

    public function update(Request $request, Medicine $medicine)
    {
        $this->authorizeMedicineAction($request->user(), 'edit_medicines');
        $this->authorizeScope($request->user(), $medicine);

        $data = $this->validatePayload($request, $medicine->hospital_id);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $medicine->hospital_id;
        }

        $this->ensureHospitalConsistency($data, $medicine);

        $medicine->update($data);

        return response()->json($medicine->fresh()->load(['manufacturer', 'medicineType']));
    }

    public function destroy(Request $request, Medicine $medicine)
    {
        $this->authorizeMedicineAction($request->user(), 'delete_medicines');
        $this->authorizeScope($request->user(), $medicine);

        $medicine->delete();

        return response()->json(['message' => 'Medicine deleted']);
    }

    private function validatePayload(Request $request, ?int $defaultHospitalId = null): array
    {
        $hospitalId = $request->integer('hospital_id') ?: $defaultHospitalId ?: $request->user()->hospital_id;

        return $request->validate([
            'hospital_id' => [$request->user()->role === 'super_admin' ? 'required' : 'sometimes', 'exists:hospitals,id'],
            'manufacturer_id' => ['required', 'exists:manufacturers,id'],
            'medicine_type_id' => ['required', 'exists:medicine_types,id'],
            'brand_name' => ['required', 'string', 'max:255'],
            'generic_name' => ['nullable', 'string', 'max:255'],
            'strength' => ['nullable', 'string', 'max:255'],
            'barcode' => ['nullable', 'string', 'max:255'],
            'stock' => ['nullable', 'integer', 'min:0'],
            'cost_price' => ['nullable', 'numeric', 'min:0'],
            'sale_price' => ['nullable', 'numeric', 'min:0'],
            'status' => ['required', 'in:active,inactive'],
        ]);
    }

    private function ensureHospitalConsistency(array &$data, ?Medicine $existing = null): void
    {
        $manufacturer = Manufacturer::findOrFail($data['manufacturer_id']);
        $medicineType = MedicineType::findOrFail($data['medicine_type_id']);

        $hospitalId = $data['hospital_id'] ?? $existing?->hospital_id ?? $manufacturer->hospital_id;

        if ((int) $manufacturer->hospital_id !== (int) $hospitalId) {
            abort(422, 'Manufacturer does not belong to the selected hospital');
        }

        if ((int) $medicineType->hospital_id !== (int) $hospitalId) {
            abort(422, 'Medicine type does not belong to the selected hospital');
        }

        $data['hospital_id'] = $hospitalId;
    }

    private function authorizeMedicineAction($user, string $permission): void
    {
        $this->ensureAnyPermission(
            $user,
            [$permission, 'manage_medicines'],
            'Only users with medicine permissions can manage medicines'
        );
    }

    private function authorizeScope($user, Medicine $medicine): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $medicine->hospital_id) {
            abort(403, 'Unauthorized medicine access');
        }
    }
}
