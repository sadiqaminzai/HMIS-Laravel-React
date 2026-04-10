<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\Sequenceable;
use Illuminate\Support\Str;

class Transaction extends Model
{
    use HasFactory, Sequenceable;

    protected static $sequenceModule = 'transaction';
    protected static $sequenceColumn = 'serial_no';

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
        'verification_token',
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

    protected static function booted()
    {
        static::creating(function (Transaction $transaction) {
            if (empty($transaction->verification_token)) {
                $transaction->verification_token = (string) Str::uuid();
            }
        });
    }

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
