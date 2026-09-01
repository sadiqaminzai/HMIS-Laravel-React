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
        'sale_unit',
        'pack_size_snapshot',
        'base_qtty',
        'base_bonus',
        'bonus',
        'price',
        'discount',
        'tax',
        'amount',
    ];

    protected $casts = [
        // 'date:Y-m-d', not 'date'. A plain date cast serialises through UTC, so
        // midnight in Kabul (+04:30) leaves as "...T19:30:00Z" and a client
        // reading the first ten characters gets the PREVIOUS day.
        'expiry_date' => 'date:Y-m-d',
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
