<?php

namespace App\Models\General;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Discount extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'discount_type_id',
        'description',
        'amount',
        'currency',
        'created_by',
        'updated_by',
        'deleted_by',
        'is_active',
        'is_delete'

    ];

    public function discount_type()
    {
        return $this->belongsTo(DiscountType::class, 'discount_type_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
