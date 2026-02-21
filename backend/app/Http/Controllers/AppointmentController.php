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
        $this->authorizeAppointmentAction($request->user(), ['add_appointments', 'schedule_appointments', 'manage_appointments']);

        $data = $this->validatePayload($request);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        }

        $this->syncDoctorHospital($data);
        $this->syncPatientSnapshot($data);

        $data['appointment_number'] = $data['appointment_number'] ?? null;

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
        $this->authorizeAppointmentAction($request->user(), ['edit_appointments', 'update_appointment_status', 'manage_appointments']);
        $this->authorizeScope($request->user(), $appointment);

        $data = $this->validatePayload($request, $appointment->id);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        }

        $this->syncDoctorHospital($data, $appointment);
        $this->syncPatientSnapshot($data);

        if (empty($data['appointment_number'])) {
            unset($data['appointment_number']);
        }

        $appointment->update($data);

        return response()->json($appointment->fresh()->load(['hospital', 'doctor', 'patient']));
    }

    public function destroy(Request $request, Appointment $appointment)
    {
        $this->authorizeAppointmentAction($request->user(), ['delete_appointments', 'manage_appointments']);
        $this->authorizeScope($request->user(), $appointment);

        $appointment->delete();

        return response()->json(['message' => 'Appointment deleted']);
    }

    private function validatePayload(Request $request, ?int $appointmentId = null): array
    {
        $hospitalId = $request->user()->role !== 'super_admin'
            ? $request->user()->hospital_id
            : $request->integer('hospital_id');

        return $request->validate([
            'hospital_id' => ['sometimes', 'required', 'exists:hospitals,id'],
            'patient_id' => ['nullable', 'exists:patients,id'],
            'doctor_id' => ['required', 'integer'],
            'appointment_number' => [
                'nullable',
                'string',
                'max:100',
                Rule::unique('appointments', 'appointment_number')
                    ->where(fn ($q) => $hospitalId ? $q->where('hospital_id', $hospitalId) : $q)
                    ->ignore($appointmentId),
            ],
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
        $doctor = $this->resolveDoctorUser((int) $data['doctor_id']);

        if (!isset($data['hospital_id'])) {
            $data['hospital_id'] = $existing?->hospital_id ?? $doctor->hospital_id;
        }

        if ((int) $doctor->hospital_id !== (int) $data['hospital_id']) {
            abort(422, 'Doctor does not belong to the selected hospital');
        }

        $data['doctor_id'] = $doctor->id;
    }

    private function resolveDoctorUser(int $doctorId): User
    {
        $doctor = User::query()
            ->whereKey($doctorId)
            ->where('role', 'doctor')
            ->first();

        if (!$doctor) {
            $doctor = User::query()
                ->where('doctor_id', $doctorId)
                ->where('role', 'doctor')
                ->first();
        }

        if (!$doctor) {
            abort(422, 'Invalid doctor selection');
        }

        return $doctor;
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

    private function authorizeAppointmentAction($user, array $permissions): void
    {
        $this->ensureAnyPermission($user, $permissions, 'Only users with appointment permissions can manage appointments');
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

}
