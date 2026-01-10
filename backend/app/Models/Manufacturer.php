<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Manufacturer extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hospital_id',
        'name',
        'license_number',
        'country',
        'status',
    ];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function medicines()
    {
        return $this->hasMany(Medicine::class);
    }
}
