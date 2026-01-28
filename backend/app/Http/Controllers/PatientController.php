<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class PatientController extends Controller
{
    public function index(Request $request)
    {
        $query = Patient::query();

        if ($request->user()->role !== 'super_admin') {
            $query->where('hospital_id', $request->user()->hospital_id);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        // Doctor scope: patients are linked to doctors via appointments.
        if ($request->user()->role === 'doctor') {
            // Doctors are users now; fallback to legacy doctor_id if present.
            $doctorId = (int) ($request->user()->doctor_id ?? $request->user()->id ?? 0);
            $allowedStatuses = ['scheduled', 'completed', 'cancelled', 'no_show'];
            $status = $request->filled('appointment_status') ? (string) $request->input('appointment_status') : null;
            $status = $status !== null ? strtolower(trim($status)) : null;

            if ($doctorId > 0) {
                $query->whereIn('id', function ($q) use ($doctorId, $status, $allowedStatuses) {
                    $q->select('patient_id')
                        ->from('appointments')
                        ->where('doctor_id', $doctorId)
                        ->whereNotNull('patient_id')
                        ->distinct();

                    if ($status !== null && in_array($status, $allowedStatuses, true)) {
                        $q->where('status', $status);
                    }
                });
            } else {
                $query->whereRaw('1 = 0');
            }
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('patient_id', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%")
                    ->orWhere('address', 'like', "%{$search}%");
            });
        }

        $patients = $query->orderBy('name')->get()->map(fn ($patient) => $this->withMediaUrls($patient));

        return response()->json($patients);
    }

    public function store(Request $request)
    {
        $this->authorizeReceptionOrAbove($request->user());

        $actor = $request->user();
        $hospitalId = $actor->role !== 'super_admin'
            ? $actor->hospital_id
            : $request->integer('hospital_id');

        if ($actor->role === 'super_admin' && empty($hospitalId)) {
            return response()->json(['message' => 'hospital_id is required'], 422);
        }

        $data = $this->validatePayload($request, null, (int) $hospitalId);
        $data['hospital_id'] = $hospitalId;
        $data['patient_id'] = null;

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->store('patients/images', 'public');
        }

        $patient = Patient::create($data);

        return response()->json($this->withMediaUrls($patient), 201);
    }

    public function show(Request $request, Patient $patient)
    {
        $this->authorizeScope($request->user(), $patient);

        return response()->json($this->withMediaUrls($patient));
    }

    public function update(Request $request, Patient $patient)
    {
        $this->authorizeReceptionOrAbove($request->user());
        $this->authorizeScope($request->user(), $patient);

        $data = $this->validatePayload($request, $patient->id, (int) $patient->hospital_id);

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->store('patients/images', 'public');
        }

        $patient->update($data);

        return response()->json($this->withMediaUrls($patient->fresh()));
    }

    public function destroy(Request $request, Patient $patient)
    {
        $this->authorizeReceptionOrAbove($request->user());
        $this->authorizeScope($request->user(), $patient);

        $patient->delete();

        return response()->json(['message' => 'Patient deleted']);
    }

    private function authorizeReceptionOrAbove($user): void
    {
        if (!in_array($user->role, ['receptionist', 'admin', 'super_admin'])) {
            abort(403, 'Only receptionists, admins or super admins can manage patients');
        }
    }

    private function authorizeScope($user, Patient $patient): void
    {
        if ($user->role !== 'super_admin' && $user->hospital_id !== $patient->hospital_id) {
            abort(403, 'Unauthorized patient access');
        }
    }

    private function validatePayload(Request $request, ?int $patientId = null, ?int $hospitalIdForUnique = null): array
    {
        $hospitalId = $hospitalIdForUnique;
        if (!$hospitalId) {
            $hospitalId = $request->user()->role !== 'super_admin'
                ? $request->user()->hospital_id
                : $request->integer('hospital_id');
        }

        $patientIdRule = $patientId === null
            ? ['nullable', 'string', 'max:50']
            : ['required', 'string', 'max:50'];

        $data = $request->validate([
            'hospital_id' => ['sometimes', 'required', 'exists:hospitals,id'],
            'patient_id' => [
                ...$patientIdRule,
                Rule::unique('patients', 'patient_id')
                    ->where(fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->ignore($patientId),
            ],
            'name' => ['required', 'string', 'max:255'],
            'age' => ['nullable', 'integer', 'min:0', 'max:150'],
            'gender' => ['required', 'in:male,female,other'],
            'phone' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'status' => ['required', 'in:active,inactive'],
            'image' => ['nullable', 'image', 'max:2048'],
        ]);

        return $data;
    }

    private function withMediaUrls(Patient $patient): Patient
    {
        $patient->image_url = $patient->image_path ? url(Storage::url($patient->image_path)) : null;
        return $patient;
    }
}
