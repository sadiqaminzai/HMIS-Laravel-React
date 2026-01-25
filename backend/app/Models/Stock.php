<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Stock extends Model
{
    use HasFactory;

    protected $fillable = [
        'hospital_id',
        'medicine_id',
        'batch_no',
        'stock_qty',
        'bonus_qty',
        'expiry_date',
        'purchase_price',
        'sale_price',
    ];

    protected $casts = [
        'stock_qty' => 'integer',
        'bonus_qty' => 'integer',
        'expiry_date' => 'date',
        'purchase_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
    ];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function medicine()
    {
        return $this->belongsTo(Medicine::class);
    }
}
