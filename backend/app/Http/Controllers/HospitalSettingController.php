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
            'invoice_fields' => $setting->resolvedInvoiceFields(),
            'invoice_field_options' => (array) config('invoice_fields.fields', []),
            'report_module_owners' => $setting->resolvedReportModuleOwners(),
            'report_desk_options' => (array) config('report_ownership.desks', []),
            'report_module_labels' => (array) config('report_ownership.modules', []),
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
            'pharmacy_customer_mode' => ['sometimes', Rule::in(['patient_only', 'walk_in_only', 'both'])],
            'pharmacy_default_customer' => ['sometimes', Rule::in(['patient', 'walk_in'])],
            'pharmacy_walk_in_default_name' => ['sometimes', 'nullable', 'string', 'max:191'],
            'pharmacy_walk_in_default_phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'pharmacy_walk_in_default_address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'pharmacy_default_barcode_type' => ['sometimes', Rule::in(['manual', 'manufacturer', 'system'])],
            'pharmacy_default_sale_unit' => ['sometimes', Rule::in(['piece', 'strip', 'pack'])],
            'barcode_scanning_enabled' => ['sometimes', 'boolean'],
            'barcode_label_width_mm' => ['sometimes', 'integer', 'min:20', 'max:210'],
            'barcode_label_height_mm' => ['sometimes', 'integer', 'min:10', 'max:297'],
            'print_paper_sizes' => ['sometimes', 'array'],
            'print_paper_sizes.*' => [Rule::in((array) config('print.sizes', []))],
            'invoice_fields' => ['sometimes', 'array'],
            'invoice_fields.*' => ['array'],
            'invoice_fields.*.*' => ['boolean'],
            'report_module_owners' => ['sometimes', 'array'],
            'report_module_owners.*' => [Rule::in(array_keys((array) config('report_ownership.desks', [])))],
            'prescription_logo_width' => ['integer', 'min:40', 'max:800'],
            'prescription_logo_height' => ['integer', 'min:40', 'max:800'],
            'prescription_signature_width' => ['integer', 'min:40', 'max:800'],
            'prescription_signature_height' => ['integer', 'min:40', 'max:800'],
            'show_out_of_stock_medicines_to_doctors' => ['boolean'],
            'show_out_of_stock_medicines_to_pharmacy' => ['boolean'],
            'show_prescription_list_meta' => ['boolean'],
        ]);

        $setting = $this->getOrCreateSetting($hospital->id);

        // Who a pharmacy sale may be made to is gated separately, so a user can
        // hold general settings access without being able to switch the hospital
        // between retail and hospital pharmacy behaviour.
        $pharmacyKeys = [
            'pharmacy_customer_mode',
            'pharmacy_default_customer',
            'pharmacy_walk_in_default_name',
            'pharmacy_walk_in_default_phone',
            'pharmacy_walk_in_default_address',
            'pharmacy_default_barcode_type',
            'pharmacy_default_sale_unit',
            'barcode_scanning_enabled',
            'barcode_label_width_mm',
            'barcode_label_height_mm',
        ];
        $touchedPharmacy = array_filter(
            $pharmacyKeys,
            fn ($key) => array_key_exists($key, $data) && (string) $data[$key] !== (string) $setting->{$key}
        );

        if (!empty($touchedPharmacy) && !$this->canManagePharmacySettings($request->user())) {
            abort(403, 'Not allowed to change pharmacy customer settings');
        }

        // Keep mode and default consistent: a hospital cannot default to an option
        // its mode does not offer, otherwise the sale screen opens on a hidden tab.
        $mode = $data['pharmacy_customer_mode'] ?? $setting->pharmacy_customer_mode ?? 'both';
        $default = $data['pharmacy_default_customer'] ?? $setting->pharmacy_default_customer ?? 'patient';

        if ($mode === 'patient_only') {
            $default = 'patient';
        } elseif ($mode === 'walk_in_only') {
            $default = 'walk_in';
        }

        if (array_key_exists('pharmacy_customer_mode', $data) || array_key_exists('pharmacy_default_customer', $data)) {
            $data['pharmacy_customer_mode'] = $mode;
            $data['pharmacy_default_customer'] = $default;
        }

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

        // Which columns an invoice offers is pharmacy behaviour, so it rides the
        // same gate as the other pharmacy settings.
        if (array_key_exists('invoice_fields', $data)) {
            $allowedTypes = array_keys((array) config('invoice_fields.types', []));
            $allowedFields = (array) config('invoice_fields.fields', []);

            $current = $setting->resolvedInvoiceFields();
            $merged = $current;
            $changed = false;

            foreach ($data['invoice_fields'] as $type => $fields) {
                if (!in_array($type, $allowedTypes, true) || !is_array($fields)) {
                    continue;
                }
                foreach ($fields as $field => $enabled) {
                    if (!in_array($field, $allowedFields, true)) {
                        continue;
                    }
                    $value = (bool) filter_var($enabled, FILTER_VALIDATE_BOOLEAN);
                    if ($value !== ($current[$type][$field] ?? false)) {
                        $changed = true;
                    }
                    $merged[$type][$field] = $value;
                }
            }

            if ($changed && !$this->canManagePharmacySettings($request->user())) {
                abort(403, 'Not allowed to change invoice field settings');
            }

            $data['invoice_fields'] = $merged;
        }

        // Reassigning income between desks decides who can see which money, so
        // it merges over the current map -- a partial payload never clears the
        // modules it does not mention.
        if (array_key_exists('report_module_owners', $data)) {
            $allowedModules = array_keys((array) config('report_ownership.owners', []));
            $incoming = array_intersect_key($data['report_module_owners'], array_flip($allowedModules));
            $data['report_module_owners'] = array_merge($setting->resolvedReportModuleOwners(), $incoming);
        }

        $setting->update($data);

        return response()->json($this->presentSetting($setting->fresh()));
    }

    private function canManagePharmacySettings($user): bool
    {
        if (!$user) {
            return false;
        }

        if ($user->role === 'super_admin') {
            return true;
        }

        $names = method_exists($user, 'permissionNames') ? $user->permissionNames() : [];

        return in_array('manage_pharmacy_settings', $names, true);
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
