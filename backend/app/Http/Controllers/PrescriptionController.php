<?php

namespace App\Http\Controllers;

use App\Models\Doctor;
use App\Models\Patient;
use App\Models\Prescription;
use App\Models\PrescriptionItem;
use App\Models\WalkInPatient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class PrescriptionController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Prescription::with(['items'])->orderByDesc('created_at');

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('doctor_id')) {
            $query->where('doctor_id', $request->integer('doctor_id'));
        }

        if ($request->filled('patient_id')) {
            $query->where('patient_id', $request->integer('patient_id'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('prescription_number', 'like', "%{$search}%")
                    ->orWhere('patient_name', 'like', "%{$search}%")
                    ->orWhere('doctor_name', 'like', "%{$search}%");
            });
        }

        return response()->json($query->get());
    }

    public function store(Request $request)
    {
        $this->authorizePrescription($request->user());

        $data = $this->validatePayload($request);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        }

        $this->ensureHospitalConsistency($data);

        if (!empty($data['is_walk_in']) && empty($data['walk_in_patient_id'])) {
            $walkIn = WalkInPatient::create([
                'hospital_id' => $data['hospital_id'],
                'name' => $data['patient_name'],
                'age' => $data['patient_age'] ?? 0,
                'gender' => $data['patient_gender'] ?? null,
                'created_by' => $request->user()->name ?? null,
            ]);
            $data['walk_in_patient_id'] = $walkIn->id;
            $data['patient_id'] = null;
        }

        $prescription = DB::transaction(function () use ($data) {
            $rxNumber = $this->generateRxNumber();
            $prescription = Prescription::create(array_merge($data, [
                'prescription_number' => $rxNumber,
                'status' => 'active',
            ]));

            foreach ($data['items'] as $item) {
                $prescription->items()->create($item);
            }

            return $prescription->load('items');
        });

        return response()->json($prescription, 201);
    }

    public function show(Request $request, Prescription $prescription)
    {
        $this->authorizeScope($request->user(), $prescription);
        return response()->json($prescription->load('items'));
    }

    public function update(Request $request, Prescription $prescription)
    {
        $this->authorizePrescription($request->user());
        $this->authorizeScope($request->user(), $prescription);

        $data = $this->validatePayload($request, $prescription->hospital_id, true);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $prescription->hospital_id;
        }

        $this->ensureHospitalConsistency($data, $prescription);

        if (!empty($data['is_walk_in']) && empty($data['walk_in_patient_id'])) {
            $walkIn = WalkInPatient::create([
                'hospital_id' => $data['hospital_id'],
                'name' => $data['patient_name'],
                'age' => $data['patient_age'] ?? 0,
                'gender' => $data['patient_gender'] ?? null,
                'created_by' => $request->user()->name ?? null,
            ]);
            $data['walk_in_patient_id'] = $walkIn->id;
            $data['patient_id'] = null;
        }

        $updated = DB::transaction(function () use ($prescription, $data) {
            $prescription->update($data);

            $prescription->items()->delete();
            foreach ($data['items'] as $item) {
                $prescription->items()->create($item);
            }

            return $prescription->load('items');
        });

        return response()->json($updated);
    }

    public function destroy(Request $request, Prescription $prescription)
    {
        $this->authorizePrescription($request->user());
        $this->authorizeScope($request->user(), $prescription);

        $prescription->delete();
        return response()->json(['message' => 'Prescription deleted']);
    }

    private function validatePayload(Request $request, ?int $defaultHospitalId = null, bool $isUpdate = false): array
    {
        $hospitalId = $request->integer('hospital_id') ?: $defaultHospitalId ?: $request->user()->hospital_id;

        $isWalkIn = $request->boolean('is_walk_in');

        $validated = $request->validate([
            'hospital_id' => [$request->user()->role === 'super_admin' ? 'required' : 'sometimes', 'exists:hospitals,id'],
            'is_walk_in' => ['sometimes', 'boolean'],
            'walk_in_patient_id' => ['nullable', 'exists:walk_in_patients,id'],
            'patient_id' => [$isWalkIn ? 'nullable' : 'required', 'exists:patients,id'],
            'patient_name' => ['required', 'string', 'max:255'],
            'patient_age' => ['required', 'integer', 'min:0'],
            'patient_gender' => ['nullable', 'string', 'max:20'],
            'doctor_id' => ['required', 'exists:doctors,id'],
            'doctor_name' => ['required', 'string', 'max:255'],
            'diagnosis' => ['nullable', 'string'],
            'advice' => ['nullable', 'string'],
            'status' => ['sometimes', Rule::in(['active', 'cancelled'])],
            'items' => ['required', 'array', 'min:1'],
            'items.*.medicine_id' => ['nullable', 'exists:medicines,id'],
            'items.*.medicine_name' => ['required', 'string', 'max:255'],
            'items.*.strength' => ['nullable', 'string', 'max:255'],
            'items.*.dose' => ['nullable', 'string', 'max:255'],
            'items.*.duration' => ['nullable', 'string', 'max:255'],
            'items.*.instruction' => ['nullable', 'string', 'max:255'],
            'items.*.quantity' => ['required', 'integer', 'min:0'],
            'items.*.type' => ['nullable', 'string', 'max:255'],
        ]);

        $validated['hospital_id'] = $hospitalId;
        $validated['created_by'] = $request->user()->name ?? null;

        $validated['is_walk_in'] = $isWalkIn;

        return $validated;
    }

    private function ensureHospitalConsistency(array &$data, ?Prescription $existing = null): void
    {
        $hospitalId = $data['hospital_id'] ?? $existing?->hospital_id;

        if (!empty($data['is_walk_in'])) {
            if (!empty($data['walk_in_patient_id'])) {
                $walkIn = WalkInPatient::findOrFail($data['walk_in_patient_id']);
                if ((int) $walkIn->hospital_id !== (int) $hospitalId) {
                    abort(422, 'Walk-in patient does not belong to the selected hospital');
                }
            }
        } else {
            $patient = Patient::findOrFail($data['patient_id']);
            if ((int) $patient->hospital_id !== (int) $hospitalId) {
                abort(422, 'Patient does not belong to the selected hospital');
            }
        }

        $doctor = Doctor::findOrFail($data['doctor_id']);
        if ((int) $doctor->hospital_id !== (int) $hospitalId) {
            abort(422, 'Doctor does not belong to the selected hospital');
        }

        $data['hospital_id'] = $hospitalId;
    }

    private function authorizePrescription($user): void
    {
        if (!in_array($user->role, ['admin', 'super_admin', 'doctor'])) {
            abort(403, 'Only admins, doctors, or super admins can manage prescriptions');
        }
    }

    private function authorizeScope($user, Prescription $prescription): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $prescription->hospital_id) {
            abort(403, 'Unauthorized prescription access');
        }
    }

    private function generateRxNumber(): string
    {
        $countToday = Prescription::whereDate('created_at', today())->count();
        return 'RX-' . now()->format('Ymd') . '-' . str_pad($countToday + 1, 4, '0', STR_PAD_LEFT);
    }
}
