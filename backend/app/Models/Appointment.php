<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\Sequenceable;

class Appointment extends Model
{
    use HasFactory, Sequenceable;

    protected static $sequenceModule = 'appointment';
    protected static $sequenceColumn = 'appointment_number';

    protected $fillable = [
        'hospital_id',
        'patient_id',
        'doctor_id',
        'appointment_number',
        'patient_name',
        'patient_age',
        'patient_gender',
        'appointment_date',
        'appointment_time',
        'reason',
        'status',
        'notes',
    ];

    protected $casts = [
        'appointment_date' => 'date',
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
}
