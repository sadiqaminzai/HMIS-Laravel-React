<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Surgery extends Model
{
    use HasFactory;

    protected $fillable = [
        'hospital_id',
        'name',
        'type_id',
        'cost',
        'description',
        'is_active',
        'is_delete',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'cost' => 'decimal:2',
        'is_active' => 'boolean',
        'is_delete' => 'boolean',
    ];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function type()
    {
        return $this->belongsTo(SurgeryType::class, 'type_id');
    }

    public function patientSurgeries()
    {
        return $this->hasMany(PatientSurgery::class);
    }
}
