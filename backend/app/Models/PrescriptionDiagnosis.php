<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PrescriptionDiagnosis extends Model
{
    use HasFactory;

    protected $fillable = [
        'hospital_id',
        'name',
        'description',
        'status',
        'created_by',
        'updated_by',
    ];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }
}
