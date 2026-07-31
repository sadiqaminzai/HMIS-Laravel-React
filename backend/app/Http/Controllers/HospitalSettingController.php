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
        return response()->json($this->presentSetting($setting));
    }

    /**
     * Always hand the client a complete paper-size map so it never has to know
     * the defaults, plus the list of sizes it may offer.
     */
    private function presentSetting(HospitalSetting $setting): array
    {
        return array_merge($setting->toArray(), [
            'print_paper_sizes' => $setting->resolvedPrintPaperSizes(),
            'print_paper_size_options' => (array) config('print.sizes', []),
        ]);
    }

    public function update(Request $request, Hospital $hospital)
    {
        $this->authorizeHospital($request->user(), $hospital, true);

        $data = $request->validate([
            'default_doctor_id' => [
                'nullable',
                'integer',
                Rule::exists('users', 'id')->where(fn ($q) => $q->where('role', 'doctor')),
            ],
            'default_to_walk_in' => ['boolean'],
            'default_prescription_next_visit' => ['boolean'],
            'auto_generate_patient_ids' => ['boolean'],
            'patient_id_prefix' => ['sometimes', 'string', 'max:10'],
            'patient_id_start' => ['sometimes', 'integer', 'min:1'],
            'patient_id_digits' => ['sometimes', 'integer', 'min:1', 'max:10'],
            'print_show_batch_column' => ['boolean'],
            'print_show_expiry_date_column' => ['boolean'],
            'print_show_bonus_column' => ['boolean'],
            'print_paper_sizes' => ['sometimes', 'array'],
            'print_paper_sizes.*' => [Rule::in((array) config('print.sizes', []))],
            'prescription_logo_width' => ['integer', 'min:40', 'max:800'],
            'prescription_logo_height' => ['integer', 'min:40', 'max:800'],
            'prescription_signature_width' => ['integer', 'min:40', 'max:800'],
            'prescription_signature_height' => ['integer', 'min:40', 'max:800'],
            'show_out_of_stock_medicines_to_doctors' => ['boolean'],
            'show_out_of_stock_medicines_to_pharmacy' => ['boolean'],
            'show_prescription_list_meta' => ['boolean'],
        ]);

        $setting = $this->getOrCreateSetting($hospital->id);

        // Per-module paper sizes are gated separately, so a user may hold general
        // settings access without being able to change what the printers produce.
        if (array_key_exists('print_paper_sizes', $data)) {
            $allowedModules = array_keys((array) config('print.modules', []));
            $incoming = array_intersect_key($data['print_paper_sizes'], array_flip($allowedModules));

            $current = $setting->resolvedPrintPaperSizes();
            $changed = array_keys(array_filter(
                $incoming,
                fn ($size, $module) => (string) $size !== (string) ($current[$module] ?? ''),
                ARRAY_FILTER_USE_BOTH
            ));

            if (!empty($changed) && !$this->canManagePrintSettings($request->user())) {
                abort(403, 'Not allowed to change print paper sizes');
            }

            // Merge so a partial payload never clears the other modules.
            $data['print_paper_sizes'] = array_merge($current, $incoming);
        }

        $setting->update($data);

        return response()->json($this->presentSetting($setting->fresh()));
    }

    private function canManagePrintSettings($user): bool
    {
        if (!$user) {
            return false;
        }

        if ($user->role === 'super_admin') {
            return true;
        }

        $names = method_exists($user, 'permissionNames') ? $user->permissionNames() : [];

        return in_array('manage_print_settings', $names, true);
    }

    private function authorizeHospital($user, Hospital $hospital, bool $write = false): void
    {
        if (!$user) {
            abort(403, 'Unauthorized');
        }

        if ($user->role === 'super_admin') {
            return;
        }

        if ($user->hospital_id !== $hospital->id) {
            abort(403, 'Unauthorized');
        }

        $permissionNames = method_exists($user, 'permissionNames')
            ? $user->permissionNames()
            : [];

        if ($write) {
            if (!in_array('edit_hospital_settings', $permissionNames, true)
                && !in_array('manage_hospital_settings', $permissionNames, true)) {
                abort(403, 'Not allowed to update settings');
            }
            return;
        }

        if (!in_array('view_hospital_settings', $permissionNames, true)
            && !in_array('manage_hospital_settings', $permissionNames, true)) {
            abort(403, 'Unauthorized');
        }
    }

    private function getOrCreateSetting(int $hospitalId): HospitalSetting
    {
        return HospitalSetting::firstOrCreate(
            ['hospital_id' => $hospitalId],
            [
                'default_to_walk_in' => false,
                'default_prescription_next_visit' => false,
                'auto_generate_patient_ids' => true,
                'patient_id_prefix' => 'P',
                'patient_id_start' => 1,
                'patient_id_digits' => 5,
                'print_show_batch_column' => true,
                'print_show_expiry_date_column' => true,
                'print_show_bonus_column' => true,
                'prescription_logo_width' => 176,
                'prescription_logo_height' => 160,
                'prescription_signature_width' => 200,
                'prescription_signature_height' => 112,
                'show_out_of_stock_medicines_to_doctors' => false,
                'show_out_of_stock_medicines_to_pharmacy' => false,
                'show_prescription_list_meta' => true,
            ]
        );
    }
}
