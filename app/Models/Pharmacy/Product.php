<?php

namespace App\Models\Pharmacy;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Product extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'cost_price',
        'sale_price',
        'packing_id',
        'company_id',
        'location',
        'created_by',
        'updated_by',
        'deleted_by',
        'is_active',
        'is_delete',
    ];

    // Relationship with Stock
    public function stock()
    {
        return $this->hasMany(Stock::class, 'product_id');
    }

    public function packing()
    {
        return $this->belongsTo(Packing::class, 'packing_id');
    }

    public function company()
    {
        return $this->belongsTo(Company::class, 'company_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
