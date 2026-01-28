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
        'reconciliation_date' => 'date',
        'physical_qty' => 'integer',
        'physical_bonus' => 'integer',
    ];
}
