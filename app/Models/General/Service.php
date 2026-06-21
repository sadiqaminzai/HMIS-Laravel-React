<?php

namespace App\Models\General;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Service extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'service_type_id',
        'description',
        'amount',
        'currency',
        'created_by',
        'updated_by',
        'deleted_by',
        'is_active',
        'is_delete',
        'is_lab_test'
    ];

    public function service_type()
    {
        return $this->belongsTo(ServiceType::class, 'service_type_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
