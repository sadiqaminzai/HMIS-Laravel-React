<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * A single X-Ray study charged at the counter.
 *
 * Unlike an ultrasound exam this carries no report: the film is read outside
 * ShifaaScript, so the record exists to price the study, collect for it and
 * print the receipt. See the create migration for why there is no type table.
 */
class XrayReceipt extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hospital_id',
        'sequence_id',
        'patient_id',
        'doctor_id',
        'xray_type_id',
        'study_name',
        'performed_at',
        'referred_by',
        'notes',
        'fee',
        'discount_enabled',
        'discount_percentage',
        'discount_amount',
        'net_amount',
        'payment_status',
        'paid_amount',
        'payment_method',
        'paid_at',
        'paid_by',
        'receipt_number',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'performed_at' => 'datetime',
        'paid_at' => 'datetime',
        'fee' => 'decimal:2',
        'discount_enabled' => 'boolean',
        'discount_percentage' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
    ];

    /** Settled at the counter. */
    public function isPaid(): bool
    {
        return (string) $this->payment_status === 'paid';
    }

    /** What the patient owes: the listed fee less any campaign discount. */
    public function payableAmount(): float
    {
        return $this->net_amount !== null
            ? (float) $this->net_amount
            : max(0.0, (float) ($this->fee ?? 0) - (float) ($this->discount_amount ?? 0));
    }

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
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

    public function xrayType()
    {
        return $this->belongsTo(XrayType::class);
    }
}
