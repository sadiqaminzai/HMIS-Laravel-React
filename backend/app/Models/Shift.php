<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Shift extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hospital_id',
        'name',
        'code',
        'start_time',
        'end_time',
        'grace_minutes',
        'is_overnight',
        'status',
        'description',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'grace_minutes' => 'integer',
        'is_overnight' => 'boolean',
    ];

    public function employees()
    {
        return $this->hasMany(Employee::class);
    }

    public function attendances()
    {
        return $this->hasMany(EmployeeAttendance::class);
    }
}
