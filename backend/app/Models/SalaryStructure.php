<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalaryStructure extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hospital_id',
        'employee_id',
        'effective_from',
        'effective_to',
        'base_salary',
        'allowances_total',
        'deductions_total',
        'net_salary',
        'currency',
        'notes',
        'status',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        // 'date:Y-m-d', not 'date'. A plain date cast serialises through UTC, so
        // midnight in Kabul (+04:30) leaves as "...T19:30:00Z" and a client
        // reading the first ten characters gets the PREVIOUS day.
        'effective_from' => 'date:Y-m-d',
        'effective_to' => 'date:Y-m-d',
        'base_salary' => 'decimal:2',
        'allowances_total' => 'decimal:2',
        'deductions_total' => 'decimal:2',
        'net_salary' => 'decimal:2',
    ];

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function components()
    {
        return $this->hasMany(SalaryComponent::class);
    }
}
