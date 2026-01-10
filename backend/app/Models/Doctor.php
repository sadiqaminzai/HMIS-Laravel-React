<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Doctor extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hospital_id',
        'name',
        'email',
        'phone',
        'specialization',
        'registration_number',
        'consultation_fee',
        'status',
        'availability_schedule',
        'image_path',
        'signature_path',
    ];

    protected $casts = [
        'consultation_fee' => 'decimal:2',
        'availability_schedule' => 'array',
    ];
}
