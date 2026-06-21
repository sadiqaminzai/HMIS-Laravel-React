<?php

namespace App\Models\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Reception\Patient;
use App\Models\Models\SurgeryType;

class Surgery extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'type_id',
        'old_type',
        'cost',
        'description',
        'is_active',
        'is_delete',
    ];

    // Relationships
    public function patientSurgeries()
    {
        return $this->hasMany(PatientSurgery::class);
    }
    
    public function surgeryType()
    {
        return $this->belongsTo(SurgeryType::class, 'type_id');
    }
    
    // Add a type relationship method to support code that uses $surgery->type as a relationship
    public function type()
    {
        return $this->belongsTo(SurgeryType::class, 'type_id');
    }
    
    // Accessor to get type name (for backward compatibility)
    public function getTypeAttribute()
    {
        return $this->surgeryType ? $this->surgeryType->name : $this->old_type;
    }
}
