<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeeAttendance extends Model
{
    use HasFactory;

    protected $fillable = [
        'hospital_id',
        'employee_id',
        'shift_id',
        'attendance_date',
        'check_in_time',
        'check_out_time',
        'status',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        // 'date:Y-m-d', not 'date'. A plain date cast serialises through UTC, so
        // midnight in Kabul (+04:30) leaves as "...T19:30:00Z" and a client
        // reading the first ten characters gets the PREVIOUS day.
        'attendance_date' => 'date:Y-m-d',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function shift()
    {
        return $this->belongsTo(Shift::class);
    }
}
