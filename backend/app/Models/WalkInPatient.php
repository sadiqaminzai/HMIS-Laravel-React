<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class WalkInPatient extends Model
{
    use HasFactory;

    protected $fillable = [
        'hospital_id',
        'name',
        'age',
        'gender',
        'created_by',
    ];

    protected $casts = [
        'age' => 'integer',
    ];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }
}
