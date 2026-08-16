<?php

namespace App\Http\Controllers;

use App\Models\Appointment;
use App\Models\HospitalSetting;
use App\Models\Patient;
use App\Models\User;
use App\Services\DiscountService;
use App\Services\LedgerPostingService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AppointmentController extends Controller
{
    public function __construct(
        private readonly DiscountService $discountService,
        private readonly LedgerPostingService $ledgerPostingService
    )
    {
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $query = Appointment::with([
            'hospital:id,name',
            'doctor:id,name,hospital_id',
            'patient:id,name,patient_id,hospital_id,phone',
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
                    ->orWhere('reason', 'like', "%{$search}%")
                    ->orWhereHas('patient', function ($patientQuery) use ($search) {
                        $patientQuery->where('phone', 'like', "%{$search}%");
                    });
            });
        }

        if ($request->filled('date_from')) {
            $query->whereDate('appointment_date', '>=', $request->date('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('appointment_date', '<=', $request->date('date_to'));
        }

        $perPage = max(1, min($request->integer('per_page', 25), 200));

        $appointments = $query
            ->orderBy('appointment_date', 'desc')
            ->orderBy('appointment_time')
            ->paginate($perPage);

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
        $this->enforceFeePermissions($data);
        $this->applyFeeDiscountRules($data);

        $data['appointment_number'] = $data['appointment_number'] ?? null;
        // Stamped server-side so the client cannot claim to be someone else.
        $data['created_by'] = $request->user()?->name;
        $data['updated_by'] = $request->user()?->name;

        $appointment = Appointment::create($data);
        $this->ledgerPostingService->upsertAppointmentSnapshot($appointment);

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
        $this->enforceFeePermissions($data, $appointment);
        $this->applyFeeDiscountRules($data);

        if (empty($data['appointment_number'])) {
            unset($data['appointment_number']);
        }

        $data['updated_by'] = $request->user()?->name;

        $appointment->update($data);

        if ((string) $appointment->status === 'cancelled') {
            $this->ledgerPostingService->voidAppointmentSnapshot($appointment, $request->user()?->name);
        } else {
            $this->ledgerPostingService->upsertAppointmentSnapshot($appointment);
        }

        return response()->json($appointment->fresh()->load(['hospital', 'doctor', 'patient']));
    }

    public function destroy(Request $request, Appointment $appointment)
    {
        $this->authorizeAppointmentAction($request->user(), ['delete_appointments', 'manage_appointments']);
        $this->authorizeScope($request->user(), $appointment);

        $appointment->delete();
        $this->ledgerPostingService->voidAppointmentSnapshot($appointment, $request->user()?->name);

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
            'appointment_time' => ['nullable', 'string', 'max:20'],
            'reason' => ['nullable', 'string', 'max:500'],
            'status' => ['required', 'in:scheduled,completed,cancelled,no_show'],
            'notes' => ['nullable', 'string'],
            'original_fee_amount' => ['nullable', 'numeric', 'min:0'],
            'discount_enabled' => ['nullable', 'boolean'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'total_amount' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:10'],
            'payment_status' => ['nullable', 'in:pending,paid,partial,cancelled'],
        ]);
    }

    /**
     * Discounting and payment state are privileged: a receptionist may book an
     * appointment without being able to waive the fee or mark it paid.
     *
     * Disabling the inputs in the UI is a convenience only — this strips the
     * values server-side so a crafted request cannot bypass it.
     */
    private function enforceFeePermissions(array &$data, ?Appointment $existing = null): void
    {
        $user = request()->user();

        $canDiscount = $user->hasAnyPermission(['add_discounts', 'edit_discounts', 'manage_discounts']);
        $canSetPayment = $user->hasAnyPermission(['manage_appointment_payments', 'manage_appointments']);

        // Undoing a collected fee is a correction, not part of taking one, so
        // it stands on its own permission -- as in lab, ultrasound and pharmacy.
        if (
            $existing !== null
            && (string) $existing->payment_status === 'paid'
            && in_array($data['payment_status'] ?? null, ['pending', 'partial', 'cancelled'], true)
            && !$user->hasAnyPermission(['reverse_appointment_payment', 'manage_appointments'])
        ) {
            $data['payment_status'] = 'paid';
        }
        $canSetFee = $user->hasAnyPermission(['override_appointment_fee', 'manage_appointment_payments', 'manage_appointments']);

        // Disabling the input is only a hint; without this a crafted request
        // could still set any consultation fee it liked. Fall back to the
        // stored fee on edit, or the doctor's own fee on create.
        if (! $canSetFee) {
            $data['original_fee_amount'] = $existing !== null
                ? (float) $existing->original_fee_amount
                : (float) ($this->resolveDoctorUser((int) ($data['doctor_id'] ?? 0))?->consultation_fee ?? 0);
        }

        if (! $canDiscount) {
            // Keep whatever was already stored; never accept a new discount.
            $data['discount_enabled'] = (bool) ($existing->discount_enabled ?? false);
            $data['discount_amount'] = (float) ($existing->discount_amount ?? 0);
        }

        if (! $canSetPayment) {
            $data['payment_status'] = $existing->payment_status
                ?? $this->defaultAppointmentPaymentStatus((int) ($data['hospital_id'] ?? 0));
        }
    }

    /**
     * What a new appointment's payment status starts on for this hospital.
     *
     * Configured under Settings > Reception. Defaults to pending, so money is
     * only ever recorded as received where the hospital has said fees are
     * collected at registration.
     */
    private function defaultAppointmentPaymentStatus(int $hospitalId): string
    {
        if ($hospitalId <= 0) {
            return 'pending';
        }

        $defaults = HospitalSetting::where('hospital_id', $hospitalId)->value('default_payment_statuses');
        $defaults = is_string($defaults) ? json_decode($defaults, true) : $defaults;

        return ($defaults['appointments'] ?? 'pending') === 'paid' ? 'paid' : 'pending';
    }

    private function applyFeeDiscountRules(array &$data): void
    {
        $computed = $this->discountService->computeFeeTotals([
            'original_fee_amount' => $data['original_fee_amount'] ?? 0,
            'discount_enabled' => $data['discount_enabled'] ?? false,
            'discount_amount' => $data['discount_amount'] ?? 0,
        ]);

        $data['original_fee_amount'] = $computed['original_fee_amount'];
        $data['discount_amount'] = $computed['discount_amount'];
        $data['total_amount'] = $computed['total_amount'];
        $data['discount_enabled'] = (bool) ($data['discount_enabled'] ?? false);
        $data['currency'] = $data['currency'] ?? 'AFN';
        $data['payment_status'] = $data['payment_status']
            ?? $this->defaultAppointmentPaymentStatus((int) ($data['hospital_id'] ?? 0));
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
