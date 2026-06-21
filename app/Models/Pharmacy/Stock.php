<?php

namespace App\Models\Pharmacy;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Pharmacy\Product;
class Stock extends Model
{
    use HasFactory;

    protected $fillable = [
        'product_id',
        'batch_no',
        'mfg_date',
        'expiry_date',
        'quantity',
        'bonus',
        'unit_price',
        'discount',
        'amount',
        'transaction_id',
        'transaction_type',
        'created_by',
        'updated_by',
    ];

    // Relationship with Product
    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    // Relationship with User (created_by)
    public function createdByUser()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // Relationship with User (updated_by)
    public function updatedByUser()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
