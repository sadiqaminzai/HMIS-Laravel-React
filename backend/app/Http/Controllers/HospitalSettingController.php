<?php

namespace App\Http\Controllers;

use App\Models\Hospital;
use App\Models\HospitalSetting;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class HospitalSettingController extends Controller
{
    public function show(Request $request, Hospital $hospital)
    {
        $this->authorizeHospital($request->user(), $hospital);
        $setting = $this->getOrCreateSetting($hospital->id);
        return response()->json($setting);
    }

    public function update(Request $request, Hospital $hospital)
    {
        $this->authorizeHospital($request->user(), $hospital, true);

        $data = $request->validate([
            'default_doctor_id' => ['nullable', 'integer', 'exists:doctors,id'],
            'default_to_walk_in' => ['boolean'],
            'auto_generate_patient_ids' => ['boolean'],
            'patient_id_prefix' => ['sometimes', 'string', 'max:10'],
            'patient_id_start' => ['sometimes', 'integer', 'min:1'],
            'patient_id_digits' => ['sometimes', 'integer', 'min:1', 'max:10'],
        ]);

        $setting = $this->getOrCreateSetting($hospital->id);
        $setting->update($data);

        return response()->json($setting->fresh());
    }

    private function authorizeHospital($user, Hospital $hospital, bool $write = false): void
    {
        if ($user->role === 'super_admin') {
            return;
        }

        if ($user->hospital_id !== $hospital->id) {
            abort(403, 'Unauthorized');
        }

        if ($write && !in_array($user->role, ['receptionist', 'admin', 'super_admin'])) {
            abort(403, 'Not allowed to update settings');
        }
    }

    private function getOrCreateSetting(int $hospitalId): HospitalSetting
    {
        return HospitalSetting::firstOrCreate(
            ['hospital_id' => $hospitalId],
            [
                'default_to_walk_in' => false,
                'auto_generate_patient_ids' => true,
                'patient_id_prefix' => 'P',
                'patient_id_start' => 1,
                'patient_id_digits' => 5,
            ]
        );
    }
}
