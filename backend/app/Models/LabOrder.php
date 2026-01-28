<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\ModuleSequence;
use App\Models\Traits\Sequenceable;
use Illuminate\Support\Str;

class LabOrder extends Model
{
    use HasFactory, SoftDeletes, Sequenceable;

    protected static $sequenceModule = 'lab';
    protected static $sequenceColumn = 'order_number';

    protected $fillable = [
        'hospital_id',
        'order_number',
        'patient_id',
        'walk_in_patient_id',
        'is_walk_in',
        'patient_name',
        'patient_age',
        'patient_gender',
        'doctor_id',
        'doctor_name',
        'total_amount',
        'paid_amount',
        'payment_status',
        'payment_method',
        'paid_at',
        'paid_by',
        'receipt_number',
        'status',
        'priority',
        'clinical_notes',
        'assigned_to',
        'assigned_to_name',
        'sample_collected_at',
        'completed_at',
        'remarks',
        'created_by',
        'updated_by',
        'verification_token',
    ];

    protected $casts = [
        'is_walk_in' => 'boolean',
        'total_amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'paid_at' => 'datetime',
        'sample_collected_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    protected static function booted()
    {
        static::creating(function (LabOrder $order) {
            if (empty($order->verification_token)) {
                $order->verification_token = (string) Str::uuid();
            }
        });
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
        return $this->belongsTo(User::class, 'doctor_id');
    }

    public function assignedTechnician()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function items()
    {
        return $this->hasMany(LabOrderItem::class);
    }

    // Generate unique order number
    public static function generateOrderNumber(int $hospitalId): string
    {
        return (string) ModuleSequence::incrementFor($hospitalId, (new self())->getSequenceModuleName());
    }

    // Calculate total from items
    public function calculateTotal(): float
    {
        return $this->items()->sum('price');
    }

    // Check if all items are completed
    public function allItemsCompleted(): bool
    {
        return $this->items()->where('status', '!=', 'completed')->count() === 0;
    }
}
