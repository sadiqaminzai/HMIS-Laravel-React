<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TransactionDetail extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'trx_id',
        'medicine_id',
        'batch_no',
        'expiry_date',
        'qtty',
        'bonus',
        'price',
        'discount',
        'tax',
        'amount',
    ];

    protected $casts = [
        'expiry_date' => 'date',
        'qtty' => 'integer',
        'bonus' => 'integer',
        'price' => 'decimal:2',
        'discount' => 'decimal:2',
        'tax' => 'decimal:2',
        'amount' => 'decimal:2',
    ];

    public function transaction()
    {
        return $this->belongsTo(Transaction::class, 'trx_id');
    }

    public function medicine()
    {
        return $this->belongsTo(Medicine::class);
    }
}
