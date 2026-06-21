<?php

namespace App\Models\Models;

use App\Models\General\Employee;
use App\Models\Reception\Patient;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PatientSurgery extends Model
{
    use HasFactory;

    protected $fillable = [
        'patient_id',
        'surgery_id',
        'doctor_id',
        'surgery_date',
        'status',
        'payment_status',
        'cost',
        'notes',
        'created_by',
        'updated_by',
        'deleted_by',
        'is_active',
        'is_delete'
    ];

    // Relationships
    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    public function surgery()
    {
        return $this->belongsTo(Surgery::class);
    }
    
    public function doctor()
    {
        return $this->belongsTo(Employee::class, 'doctor_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}