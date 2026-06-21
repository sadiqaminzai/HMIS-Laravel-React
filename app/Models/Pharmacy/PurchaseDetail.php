<?php

namespace App\Models\Pharmacy;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseDetail extends Model
{
    use HasFactory;

    protected $fillable = [
        'purchase_id',
        'product_id',
        'batch_no',
        'mfg_date',
        'expiry_date',
        'quantity',
        'bonus_quantity',
        'unit_price',
        'discount',
        'amount',
        'created_by',
        'updated_by',
        'deleted_by',
        'is_active',
        'is_delete',
    ];

    public function purchase()
    {
        return $this->belongsTo(Purchase::class, 'purchase_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }
}
