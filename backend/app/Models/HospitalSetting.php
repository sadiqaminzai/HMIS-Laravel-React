<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class HospitalSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'hospital_id',
        'default_doctor_id',
        'default_to_walk_in',
        'auto_generate_patient_ids',
        'patient_id_prefix',
        'patient_id_start',
        'patient_id_digits',
    ];

    protected $casts = [
        'default_to_walk_in' => 'boolean',
        'auto_generate_patient_ids' => 'boolean',
    ];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function defaultDoctor()
    {
        return $this->belongsTo(Doctor::class, 'default_doctor_id');
    }
}
