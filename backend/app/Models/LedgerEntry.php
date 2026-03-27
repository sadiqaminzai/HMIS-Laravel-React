<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LedgerEntry extends Model
{
    use HasFactory;

    protected $fillable = [
        'hospital_id',
        'source_type',
        'source_id',
        'event_type',
        'revision',
        'entry_direction',
        'module',
        'category',
        'title',
        'patient_id',
        'supplier_id',
        'amount',
        'discount_amount',
        'tax_amount',
        'net_amount',
        'paid_amount',
        'due_amount',
        'currency',
        'status',
        'posted_at',
        'voided_at',
        'posted_by',
        'metadata',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'tax_amount' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'due_amount' => 'decimal:2',
        'posted_at' => 'datetime',
        'voided_at' => 'datetime',
        'metadata' => 'array',
    ];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }
}
