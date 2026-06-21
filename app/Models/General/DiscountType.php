<?php

namespace App\Models\General;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DiscountType extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'details',
        'created_by',
        'updated_by',
        'deleted_by',
        'is_active',
        'is_delete'
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
