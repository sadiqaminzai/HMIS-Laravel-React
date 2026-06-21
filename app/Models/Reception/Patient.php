<?php

namespace App\Models\Reception;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Patient extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'father_name',
        'mobile',
        'email',
        'age',
        'gender',
        'address',
        'city',
        'state',
        'zip_code',
        'emergency_contact_name',
        'emergency_contact_number',
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
