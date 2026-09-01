<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\Sequenceable;

class StockReconciliation extends Model
{
    use HasFactory, Sequenceable;

    protected static $sequenceModule = 'stock_reconciliation';
    protected static $sequenceColumn = 'serial_no';

    protected $fillable = [
        'hospital_id',
        'medicine_id',
        'batch_no',
        'reconciliation_date',
        'physical_qty',
        'physical_bonus',
        'created_by',
    ];

    protected $casts = [
        // 'date:Y-m-d', not 'date'. A plain date cast serialises through UTC, so
        // midnight in Kabul (+04:30) leaves as "...T19:30:00Z" and a client
        // reading the first ten characters gets the PREVIOUS day.
        'reconciliation_date' => 'date:Y-m-d',
        'physical_qty' => 'integer',
        'physical_bonus' => 'integer',
    ];
}
