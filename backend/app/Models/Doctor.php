<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Traits\Sequenceable;

class Doctor extends Model
{
    use HasFactory, SoftDeletes, Sequenceable;

    protected static $sequenceModule = 'doctor';
    protected static $sequenceColumn = 'serial_no';

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
