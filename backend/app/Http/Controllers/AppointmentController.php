<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\Patient;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AppointmentController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Appointment::with([
            'hospital:id,name',
            'doctor:id,name,hospital_id',
            'patient:id,name,patient_id,hospital_id',
        ]);

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($user->role === 'doctor') {
            $query->where('doctor_id', $user->id);
        }

        if ($request->filled('doctor_id')) {
            $query->where('doctor_id', $request->integer('doctor_id'));
        }

        if ($request->filled('patient_id')) {
            $query->where('patient_id', $request->integer('patient_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('patient_name', 'like', "%{$search}%")
                    ->orWhere('appointment_number', 'like', "%{$search}%")
                    ->orWhere('reason', 'like', "%{$search}%");
            });
        }

        if ($request->filled('date_from')) {
            $query->whereDate('appointment_date', '>=', $request->date('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('appointment_date', '<=', $request->date('date_to'));
        }

        $appointments = $query
            ->orderBy('appointment_date', 'desc')
            ->orderBy('appointment_time')
            ->get();

        return response()->json($appointments);
    }

    public function store(Request $request)
    {
        $this->authorizeReceptionOrAbove($request->user());

        $data = $this->validatePayload($request);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        }

        $this->syncDoctorHospital($data);
        $this->syncPatientSnapshot($data);

        if (empty($data['appointment_number'])) {
            $data['appointment_number'] = $this->generateAppointmentNumber($data['hospital_id']);
        }

        $appointment = Appointment::create($data);

        return response()->json($appointment->load(['hospital', 'doctor', 'patient']), 201);
    }

    public function show(Request $request, Appointment $appointment)
    {
        $this->authorizeScope($request->user(), $appointment);

        return response()->json($appointment->load(['hospital', 'doctor', 'patient']));
    }

    public function update(Request $request, Appointment $appointment)
    {
        $this->authorizeReceptionOrAbove($request->user());
        $this->authorizeScope($request->user(), $appointment);

        $data = $this->validatePayload($request, $appointment->id);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        }

        $this->syncDoctorHospital($data, $appointment);
        $this->syncPatientSnapshot($data);

        if (empty($data['appointment_number'])) {
            $data['appointment_number'] = $appointment->appointment_number ?? $this->generateAppointmentNumber($appointment->hospital_id);
        }

        $appointment->update($data);

        return response()->json($appointment->fresh()->load(['hospital', 'doctor', 'patient']));
    }

    public function destroy(Request $request, Appointment $appointment)
    {
        $this->authorizeReceptionOrAbove($request->user());
        $this->authorizeScope($request->user(), $appointment);

        $appointment->delete();

        return response()->json(['message' => 'Appointment deleted']);
    }

    private function validatePayload(Request $request, ?int $appointmentId = null): array
    {
        return $request->validate([
            'hospital_id' => ['sometimes', 'required', 'exists:hospitals,id'],
            'patient_id' => ['nullable', 'exists:patients,id'],
            'doctor_id' => [
                'required',
                Rule::exists('users', 'id')->where(fn ($q) => $q->where('role', 'doctor')),
            ],
            'appointment_number' => ['nullable', 'string', 'max:100', Rule::unique('appointments', 'appointment_number')->ignore($appointmentId)],
            'patient_name' => ['required_without:patient_id', 'string', 'max:255'],
            'patient_age' => ['nullable', 'integer', 'min:0', 'max:150'],
            'patient_gender' => ['nullable', 'in:male,female,other'],
            'appointment_date' => ['required', 'date'],
            'appointment_time' => ['required', 'string', 'max:20'],
            'reason' => ['nullable', 'string', 'max:500'],
            'status' => ['required', 'in:scheduled,completed,cancelled,no_show'],
            'notes' => ['nullable', 'string'],
        ]);
    }

    private function syncDoctorHospital(array &$data, ?Appointment $existing = null): void
    {
        $doctor = User::query()
            ->whereKey($data['doctor_id'])
            ->where('role', 'doctor')
            ->firstOrFail();

        if (!isset($data['hospital_id'])) {
            $data['hospital_id'] = $existing?->hospital_id ?? $doctor->hospital_id;
        }

        if ((int) $doctor->hospital_id !== (int) $data['hospital_id']) {
            abort(422, 'Doctor does not belong to the selected hospital');
        }
    }

    private function syncPatientSnapshot(array &$data): void
    {
        if (empty($data['patient_id'])) {
            return;
        }

        $patient = Patient::findOrFail($data['patient_id']);

        if ((int) $patient->hospital_id !== (int) $data['hospital_id']) {
            abort(422, 'Patient does not belong to the selected hospital');
        }

        $data['patient_name'] = $data['patient_name'] ?? $patient->name;
        $data['patient_age'] = $data['patient_age'] ?? $patient->age;
        $data['patient_gender'] = $data['patient_gender'] ?? $patient->gender;
    }

    private function authorizeReceptionOrAbove($user): void
    {
        if (!in_array($user->role, ['receptionist', 'admin', 'super_admin'])) {
            abort(403, 'Only receptionists, admins or super admins can manage appointments');
        }
    }

    private function authorizeScope($user, Appointment $appointment): void
    {
        if ($user->role !== 'super_admin' && $user->hospital_id !== $appointment->hospital_id) {
            abort(403, 'Unauthorized appointment access');
        }

        if ($user->role === 'doctor' && (int) $appointment->doctor_id !== (int) $user->id) {
            abort(403, 'Unauthorized appointment access');
        }
    }

    private function generateAppointmentNumber(int $hospitalId): string
    {
        $sequence = Appointment::where('hospital_id', $hospitalId)->count() + 1;
        $year = now()->format('Y');

        return sprintf('APT-%d-%s-%s', $hospitalId, $year, str_pad((string) $sequence, 5, '0', STR_PAD_LEFT));
    }
}
