<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Transaction extends Model
{
    use HasFactory;

    protected $fillable = [
        'hospital_id',
        'supplier_id',
        'supplier_name',
        'patient_id',
        'patient_name',
        'trx_type',
        'grand_total',
        'total_discount',
        'total_tax',
        'paid_amount',
        'due_amount',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'grand_total' => 'decimal:2',
        'total_discount' => 'decimal:2',
        'total_tax' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'due_amount' => 'decimal:2',
    ];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    public function details()
    {
        return $this->hasMany(TransactionDetail::class, 'trx_id');
    }
}
