<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\Sequenceable;

class HospitalSetting extends Model
{
    use HasFactory, Sequenceable;

    protected static $sequenceModule = 'hospital_setting';
    protected static $sequenceColumn = 'serial_no';

    protected $fillable = [
        'hospital_id',
        'default_doctor_id',
        'default_to_walk_in',
        'default_prescription_next_visit',
        'auto_generate_patient_ids',
        'patient_id_prefix',
        'patient_id_start',
        'patient_id_digits',
        'print_show_batch_column',
        'print_show_expiry_date_column',
        'print_show_bonus_column',
        'print_paper_sizes',
        'invoice_fields',
        'report_module_owners',
        'pharmacy_customer_mode',
        'pharmacy_default_customer',
        'pharmacy_walk_in_default_name',
        'pharmacy_walk_in_default_phone',
        'pharmacy_walk_in_default_address',
        'pharmacy_walk_in_show_phone',
        'pharmacy_walk_in_show_address',
        'pharmacy_walk_in_name_editable',
        'pharmacy_default_barcode_type',
        'pharmacy_default_sale_unit',
        'barcode_scanning_enabled',
        'lab_default_payment_status',
        'default_payment_statuses',
        'barcode_label_width_mm',
        'barcode_label_height_mm',
        'prescription_logo_width',
        'prescription_logo_height',
        'prescription_signature_width',
        'prescription_signature_height',
        'prescription_watermark_enabled',
        'prescription_watermark_source',
        'prescription_watermark_path',
        'prescription_watermark_width',
        'show_out_of_stock_medicines_to_doctors',
        'show_out_of_stock_medicines_to_pharmacy',
        'show_prescription_list_meta',
    ];

    protected $casts = [
        'default_to_walk_in' => 'boolean',
        'default_prescription_next_visit' => 'boolean',
        'auto_generate_patient_ids' => 'boolean',
        'print_show_batch_column' => 'boolean',
        'print_show_expiry_date_column' => 'boolean',
        'print_show_bonus_column' => 'boolean',
        'barcode_scanning_enabled' => 'boolean',
        'pharmacy_walk_in_show_phone' => 'boolean',
        'pharmacy_walk_in_show_address' => 'boolean',
        'pharmacy_walk_in_name_editable' => 'boolean',
        'default_payment_statuses' => 'array',
        'print_paper_sizes' => 'array',
        'invoice_fields' => 'array',
        'report_module_owners' => 'array',
        'prescription_logo_width' => 'integer',
        'prescription_logo_height' => 'integer',
        'prescription_signature_width' => 'integer',
        'prescription_signature_height' => 'integer',
        'prescription_watermark_enabled' => 'boolean',
        'prescription_watermark_width' => 'integer',
        'show_out_of_stock_medicines_to_doctors' => 'boolean',
        'show_out_of_stock_medicines_to_pharmacy' => 'boolean',
        'show_prescription_list_meta' => 'boolean',
    ];

    /**
     * Stored per-module paper sizes merged over the defaults in config/print.php,
     * with unknown modules dropped and invalid sizes falling back to the default.
     * Always returns an entry for every configurable module.
     *
     * @return array<string, string>
     */
    public function resolvedPrintPaperSizes(): array
    {
        $defaults = (array) config('print.modules', []);
        $allowedSizes = (array) config('print.sizes', []);
        $stored = is_array($this->print_paper_sizes) ? $this->print_paper_sizes : [];

        $resolved = [];
        foreach ($defaults as $module => $default) {
            $candidate = $stored[$module] ?? null;
            $resolved[$module] = in_array($candidate, $allowedSizes, true)
                ? (string) $candidate
                : (string) $default;
        }

        return $resolved;
    }

    /**
     * Stored per-invoice-type column visibility merged over the defaults in
     * config/invoice_fields.php. Unknown invoice types and unknown fields are
     * dropped, and every configurable type always comes back complete so the
     * client never has to know the defaults.
     *
     * @return array<string, array<string, bool>>
     */
    public function resolvedInvoiceFields(): array
    {
        $defaults = (array) config('invoice_fields.types', []);
        $allowedFields = (array) config('invoice_fields.fields', []);
        $stored = is_array($this->invoice_fields) ? $this->invoice_fields : [];

        $resolved = [];
        foreach ($defaults as $type => $typeDefaults) {
            $storedType = is_array($stored[$type] ?? null) ? $stored[$type] : [];
            foreach ($allowedFields as $field) {
                $resolved[$type][$field] = array_key_exists($field, $storedType)
                    ? (bool) filter_var($storedType[$field], FILTER_VALIDATE_BOOLEAN)
                    : (bool) ($typeDefaults[$field] ?? false);
            }
        }

        return $resolved;
    }

    /**
     * Stored income-module ownership merged over the defaults in
     * config/report_ownership.php. Unknown modules and unknown desks are
     * dropped, and every configurable module always comes back, so the client
     * never has to know the defaults.
     *
     * @return array<string, string>
     */
    public function resolvedReportModuleOwners(): array
    {
        $defaults = (array) config('report_ownership.owners', []);
        $allowedDesks = array_keys((array) config('report_ownership.desks', []));
        $stored = is_array($this->report_module_owners) ? $this->report_module_owners : [];

        $resolved = [];
        foreach ($defaults as $module => $default) {
            $candidate = $stored[$module] ?? null;
            $resolved[$module] = in_array($candidate, $allowedDesks, true)
                ? (string) $candidate
                : (string) $default;
        }

        return $resolved;
    }

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function defaultDoctor()
    {
        return $this->belongsTo(User::class, 'default_doctor_id');
    }
}
