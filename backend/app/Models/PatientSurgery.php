<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PatientSurgery extends Model
{
    use HasFactory;

    protected $fillable = [
        'hospital_id',
        'patient_id',
        'doctor_id',
        'surgery_id',
        'surgery_date',
        'status',
        'payment_status',
        'cost',
        'notes',
        'is_active',
        'is_delete',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'surgery_date' => 'date',
        'cost' => 'decimal:2',
        'is_active' => 'boolean',
        'is_delete' => 'boolean',
    ];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    public function doctor()
    {
        return $this->belongsTo(User::class, 'doctor_id');
    }

    public function surgery()
    {
        return $this->belongsTo(Surgery::class);
    }
}
