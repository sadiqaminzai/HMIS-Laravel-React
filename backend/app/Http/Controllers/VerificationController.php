<?php

namespace App\Http\Controllers;

use App\Models\LabOrder;
use App\Models\Patient;
use App\Models\Prescription;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

class VerificationController extends Controller
{
    public function prescription(string $token)
    {
        $prescription = Prescription::with(['items', 'hospital', 'patient', 'doctor'])
            ->where('verification_token', $token)
            ->firstOrFail();

        $doctorPayload = $this->doctorPayload($prescription->doctor);

        return response()->json([
            'data' => [
                'prescription' => $prescription,
                'hospital' => $prescription->hospital,
                'patient' => $prescription->patient,
                'doctor' => $doctorPayload,
                'patient_snapshot' => [
                    'patient_id' => $prescription->patient_id,
                    'walk_in_patient_id' => $prescription->walk_in_patient_id,
                    'name' => $prescription->patient_name,
                    'age' => $prescription->patient_age,
                    'gender' => $prescription->patient_gender,
                ],
            ],
        ]);
    }

    public function patient(string $token)
    {
        $patient = Patient::with('hospital')
            ->where('verification_token', $token)
            ->firstOrFail();

        $patient->image_url = $patient->image_path ? url(Storage::url($patient->image_path)) : null;

        return response()->json([
            'data' => [
                'patient' => $patient,
                'hospital' => $patient->hospital,
            ],
        ]);
    }

    public function labReport(string $token)
    {
        $order = LabOrder::with(['items.results', 'hospital', 'patient', 'doctor'])
            ->where('verification_token', $token)
            ->firstOrFail();

        return response()->json([
            'data' => [
                'lab_order' => $order,
                'hospital' => $order->hospital,
                'doctor' => $this->doctorPayload($order->doctor),
                'patient' => $order->patient,
                'patient_snapshot' => [
                    'patient_id' => $order->patient_id,
                    'walk_in_patient_id' => $order->walk_in_patient_id,
                    'name' => $order->patient_name,
                    'age' => $order->patient_age,
                    'gender' => $order->patient_gender,
                ],
            ],
        ]);
    }

    private function doctorPayload(?User $doctor): ?array
    {
        if (!$doctor) {
            return null;
        }

        $doctor->image_url = $doctor->image_path ? url(Storage::url($doctor->image_path)) : null;
        $doctor->signature_url = $doctor->signature_path ? url(Storage::url($doctor->signature_path)) : null;

        return [
            'id' => $doctor->id,
            'hospital_id' => $doctor->hospital_id,
            'name' => $doctor->name,
            'email' => $doctor->email,
            'phone' => $doctor->phone,
            'specialization' => $doctor->specialization ?? '',
            'registration_number' => $doctor->registration_number,
            'consultation_fee' => $doctor->consultation_fee ?? 0,
            'status' => $doctor->doctor_status ?? ($doctor->is_active ? 'active' : 'inactive'),
            'availability_schedule' => $doctor->availability_schedule,
            'image_path' => $doctor->image_path,
            'signature_path' => $doctor->signature_path,
            'image_url' => $doctor->image_url ?? null,
            'signature_url' => $doctor->signature_url ?? null,
            'created_at' => $doctor->created_at,
            'updated_at' => $doctor->updated_at,
        ];
    }
}
