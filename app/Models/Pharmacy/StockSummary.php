<?php

namespace App\Models\Pharmacy;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StockSummary extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'batch_no',
        'opening_quantity',
        'opening_amount',
        'purchase_quantity',
        'purchase_amount',
        'transfer_in_quantity',
        'transfer_in_amount',
        'sale_quantity',
        'sale_amount',
        'return_quantity',
        'return_amount',
        'net_sale_quantity',
        'net_sale_amount',
        'transfer_out_quantity',
        'transfer_out_amount',
        'closing_quantity',
        'closing_amount',
        'transaction_id',
        'transaction_type',
        'created_by',
        'updated_by',
    ];
}
