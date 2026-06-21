<?php

namespace App\Models\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SurgeryType extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'is_active',
        'is_delete'
    ];

    // Relationship: a surgery type can have many surgeries
    public function surgeries()
    {
        return $this->hasMany(Surgery::class, 'type_id');
    }
}
