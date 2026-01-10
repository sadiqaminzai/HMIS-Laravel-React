<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Prescription extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hospital_id',
        'patient_id',
        'walk_in_patient_id',
        'is_walk_in',
        'patient_name',
        'patient_age',
        'patient_gender',
        'doctor_id',
        'doctor_name',
        'diagnosis',
        'advice',
        'prescription_number',
        'status',
        'created_by',
    ];

    protected $casts = [
        'patient_age' => 'integer',
        'is_walk_in' => 'boolean',
    ];

    public function items()
    {
        return $this->hasMany(PrescriptionItem::class);
    }

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    public function walkInPatient()
    {
        return $this->belongsTo(WalkInPatient::class);
    }

    public function doctor()
    {
        return $this->belongsTo(Doctor::class);
    }
}
