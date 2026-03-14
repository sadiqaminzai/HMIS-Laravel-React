<?php

namespace App\Http\Controllers;

use App\Models\MedicineSet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MedicineSetController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = MedicineSet::query()->with('items')->orderBy('name');

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

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $this->ensureAnyPermission($request->user(), ['add_treatment_sets', 'manage_treatment_sets', 'add_prescriptions', 'manage_prescriptions'], 'Unauthorized to create medicine sets');

        $data = $this->validatePayload($request);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        }

        $set = DB::transaction(function () use ($data, $request) {
            $items = $data['items'];
            unset($data['items']);

            $set = MedicineSet::create([
                ...$data,
                'created_by' => $request->user()?->name,
            ]);

            $set->items()->createMany($items);

            return $set->load('items');
        });

        return response()->json($set, 201);
    }

    public function show(Request $request, MedicineSet $medicineSet)
    {
        $this->authorizeScope($request->user(), $medicineSet);
        return response()->json($medicineSet->load('items'));
    }

    public function update(Request $request, MedicineSet $medicineSet)
    {
        $this->ensureAnyPermission($request->user(), ['edit_treatment_sets', 'manage_treatment_sets', 'edit_prescriptions', 'manage_prescriptions'], 'Unauthorized to update medicine sets');
        $this->authorizeScope($request->user(), $medicineSet);

        $data = $this->validatePayload($request, true, $medicineSet->hospital_id);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $medicineSet->hospital_id;
        }

        $updated = DB::transaction(function () use ($medicineSet, $data, $request) {
            $items = $data['items'];
            unset($data['items']);

            $medicineSet->fill($data);
            $medicineSet->updated_by = $request->user()?->name;
            $medicineSet->save();

            $medicineSet->items()->delete();
            $medicineSet->items()->createMany($items);

            return $medicineSet->load('items');
        });

        return response()->json($updated);
    }

    public function destroy(Request $request, MedicineSet $medicineSet)
    {
        $this->ensureAnyPermission($request->user(), ['delete_treatment_sets', 'manage_treatment_sets', 'delete_prescriptions', 'manage_prescriptions'], 'Unauthorized to delete medicine sets');
        $this->authorizeScope($request->user(), $medicineSet);

        $medicineSet->delete();
        return response()->json(['message' => 'Medicine set deleted']);
    }

    private function validatePayload(Request $request, bool $isUpdate = false, ?int $defaultHospitalId = null): array
    {
        $hospitalId = $request->integer('hospital_id') ?: $defaultHospitalId ?: $request->user()->hospital_id;

        return $request->validate([
            'hospital_id' => [$request->user()->role === 'super_admin' ? 'required' : 'sometimes', 'exists:hospitals,id'],
            'name' => [
                $isUpdate ? 'sometimes' : 'required',
                'string',
                'max:255',
                Rule::unique('medicine_sets', 'name')->where(fn ($q) => $q->where('hospital_id', $hospitalId))->ignore($request->route('medicineSet')?->id),
            ],
            'description' => ['nullable', 'string'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'items' => ['required', 'array', 'min:1'],
            'items.*.medicine_id' => ['nullable', 'exists:medicines,id'],
            'items.*.medicine_name' => ['required', 'string', 'max:255'],
            'items.*.strength' => ['nullable', 'string', 'max:255'],
            'items.*.dose' => ['nullable', 'string', 'max:255'],
            'items.*.duration' => ['nullable', 'string', 'max:255'],
            'items.*.instruction' => ['nullable', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'integer', 'min:0'],
            'items.*.type' => ['nullable', 'string', 'max:255'],
            'items.*.sort_order' => ['nullable', 'integer', 'min:0'],
        ]);
    }

    private function authorizeScope($user, MedicineSet $medicineSet): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $medicineSet->hospital_id) {
            abort(403, 'Unauthorized medicine set access');
        }
    }
}
