<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Traits\Sequenceable;
use Illuminate\Support\Str;

class Patient extends Model
{
    use HasFactory, SoftDeletes, Sequenceable;

    protected static $sequenceModule = 'patient';
    protected static $sequenceColumn = 'patient_id';

    protected $fillable = [
        'hospital_id',
        'patient_id',
        'name',
        'age',
        'gender',
        'phone',
        'address',
        'status',
        'image_path',
        'verification_token',
    ];

    protected $casts = [
        'age' => 'integer',
    ];

    protected static function booted()
    {
        static::creating(function (Patient $patient) {
            if (empty($patient->verification_token)) {
                $patient->verification_token = (string) Str::uuid();
            }
        });
    }

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

}
