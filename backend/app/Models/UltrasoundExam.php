<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class UltrasoundExam extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hospital_id',
        'sequence_id',
        'patient_id',
        'doctor_id',
        'ultrasound_type_id',
        'examined_at',
        'referred_by',
        'clinical_notes',
        'report_body',
        'impression',
        'status',
        'payment_status',
        'fee',
        'paid_amount',
        'payment_method',
        'paid_at',
        'paid_by',
        'receipt_number',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'examined_at' => 'datetime',
        'paid_at' => 'datetime',
        'fee' => 'decimal:2',
        'paid_amount' => 'decimal:2',
    ];

    /** Settled at the counter, so the specialist may begin. */
    public function isPaid(): bool
    {
        return (string) $this->payment_status === 'paid';
    }

    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    /** Doctors are users; the `doctors` table is only a synced profile mirror. */
    public function doctor()
    {
        return $this->belongsTo(User::class, 'doctor_id');
    }

    public function ultrasoundType()
    {
        return $this->belongsTo(UltrasoundType::class);
    }
}
