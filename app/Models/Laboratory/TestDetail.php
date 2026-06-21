<?php

namespace App\Models\Laboratory;

use App\Models\General\Service;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TestDetail extends Model
{
    use HasFactory;

    protected $fillable = [
        'test_type_id',
        'name',
        'normal_range',
        'unit',
        'description',
        'created_by',
        'updated_by',
        'deleted_by',
        'is_active',
        'is_delete'
    ];

    public function service()
    {
        return $this->belongsTo(Service::class, 'test_type_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

}
