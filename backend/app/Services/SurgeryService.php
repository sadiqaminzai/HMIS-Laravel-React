<?php

namespace App\Services;

use App\Models\PatientSurgery;
use App\Models\Surgery;
use App\Models\SurgeryType;
use Illuminate\Validation\ValidationException;

class SurgeryService
{
    public function resolveCost(Surgery $surgery, $providedCost): float
    {
        if ($providedCost === null || $providedCost === '') {
            return round((float) $surgery->cost, 2);
        }

        return round(max(0, (float) $providedCost), 2);
    }

    public function assertTypeDeletable(SurgeryType $type): void
    {
        $hasDependencies = $type->surgeries()->where('is_delete', false)->exists();

        if ($hasDependencies) {
            throw ValidationException::withMessages([
                'type_id' => ['Cannot delete surgery type while surgeries depend on it.'],
            ]);
        }
    }

    public function assertSurgeryDeletable(Surgery $surgery): void
    {
        $hasDependencies = $surgery->patientSurgeries()->where('is_delete', false)->exists();

        if ($hasDependencies) {
            throw ValidationException::withMessages([
                'surgery_id' => ['Cannot delete surgery while patient surgeries depend on it.'],
            ]);
        }
    }

    public function togglePaymentStatus(PatientSurgery $patientSurgery): string
    {
        if ($patientSurgery->payment_status === 'pending') {
            return 'paid';
        }

        if ($patientSurgery->payment_status === 'paid') {
            return 'pending';
        }

        throw ValidationException::withMessages([
            'payment_status' => ['Only pending and paid can be toggled with this endpoint.'],
        ]);
    }
}
