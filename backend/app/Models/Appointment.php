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
        // Without this the unit was silently dropped by mass assignment: the
        // frontend sent it, validation accepted it and the snapshot helper set
        // it, but create() ignored the key and the column fell back to its
        // default -- so a 20-month-old printed as "20 Years" on the fees card.
        'patient_age_unit',
        'patient_gender',
        'appointment_date',
        'appointment_time',
        'reason',
        'status',
        'notes',
        'original_fee_amount',
        'discount_enabled',
        'discount_amount',
        'total_amount',
        'currency',
        'payment_status',
        'payment_method',
        'paid_at',
        'paid_by',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'paid_at' => 'datetime',
        'appointment_date' => 'date:Y-m-d',
        'original_fee_amount' => 'decimal:2',
        'discount_enabled' => 'boolean',
        'discount_amount' => 'decimal:2',
        'total_amount' => 'decimal:2',
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
