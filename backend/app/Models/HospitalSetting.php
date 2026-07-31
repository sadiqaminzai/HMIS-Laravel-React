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
        'prescription_logo_width',
        'prescription_logo_height',
        'prescription_signature_width',
        'prescription_signature_height',
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
        'print_paper_sizes' => 'array',
        'prescription_logo_width' => 'integer',
        'prescription_logo_height' => 'integer',
        'prescription_signature_width' => 'integer',
        'prescription_signature_height' => 'integer',
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

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function defaultDoctor()
    {
        return $this->belongsTo(User::class, 'default_doctor_id');
    }
}
