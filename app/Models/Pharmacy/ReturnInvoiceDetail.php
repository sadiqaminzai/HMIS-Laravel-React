<?php

namespace App\Models\Pharmacy;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\User;
use App\Models\Pharmacy\ReturnInvoice;

class ReturnInvoiceDetail extends Model
{
    use HasFactory;
    protected $fillable = [
        'return_invoice_id',
        'product_id',
        'batch_no',
        'mfg_date',
        'expiry_date',
        'quantity',
        'bonus_quantity',
        'unit_price',
        'discount',
        'amount',
        'is_active',
        'is_delete',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    public function saleInvoice()
    {
        return $this->belongsTo(ReturnInvoice::class, 'return_invoice_id');
    }

    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
