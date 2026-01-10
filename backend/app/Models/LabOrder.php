<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class LabOrder extends Model
{
    use HasFactory, SoftDeletes;

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
    ];

    protected $casts = [
        'is_walk_in' => 'boolean',
        'total_amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'paid_at' => 'datetime',
        'sample_collected_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

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
        $prefix = 'LAB';
        $date = now()->format('Ymd');
        $lastOrder = self::where('hospital_id', $hospitalId)
            ->whereDate('created_at', today())
            ->orderByDesc('id')
            ->first();

        $sequence = $lastOrder ? ((int) substr($lastOrder->order_number, -4)) + 1 : 1;

        return sprintf('%s-%s-%04d', $prefix, $date, $sequence);
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
