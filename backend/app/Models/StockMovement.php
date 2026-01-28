<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\Sequenceable;

class StockMovement extends Model
{
    use HasFactory, Sequenceable;

    protected static $sequenceModule = 'stock_movement';
    protected static $sequenceColumn = 'serial_no';

    protected $fillable = [
        'hospital_id',
        'medicine_id',
        'trx_id',
        'trx_type',
        'batch_no',
        'expiry_date',
        'qty_change',
        'bonus_change',
        'unit_price',
        'balance_qty',
        'balance_bonus',
        'actor',
        'is_reversal',
    ];

    protected $casts = [
        'qty_change' => 'integer',
        'bonus_change' => 'integer',
        'balance_qty' => 'integer',
        'balance_bonus' => 'integer',
        'expiry_date' => 'date',
        'unit_price' => 'decimal:2',
        'is_reversal' => 'boolean',
    ];
}
