<?php

namespace App\Http\Controllers;

use App\Models\Patient;
use App\Models\HospitalSetting;
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

        // Apply default doctor if none provided
        if (empty($data['referred_doctor_id'])) {
            $setting = HospitalSetting::where('hospital_id', $data['hospital_id'])->first();
            if ($setting && $setting->default_doctor_id) {
                $data['referred_doctor_id'] = $setting->default_doctor_id;
            }
        }

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

        $data = $request->validate([
            'hospital_id' => ['sometimes', 'required', 'exists:hospitals,id'],
            'patient_id' => [
                'required',
                'string',
                'max:50',
                Rule::unique('patients', 'patient_id')
                    ->where(fn ($q) => $q->where('hospital_id', $hospitalId))
                    ->ignore($patientId),
            ],
            'name' => ['required', 'string', 'max:255'],
            'age' => ['nullable', 'integer', 'min:0', 'max:150'],
            'gender' => ['required', 'in:male,female,other'],
            'phone' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string', 'max:500'],
            'referred_doctor_id' => ['nullable', 'exists:doctors,id'],
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
