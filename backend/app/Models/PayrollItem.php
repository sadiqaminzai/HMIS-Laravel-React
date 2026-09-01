<?php

namespace App\Models;

use App\Models\Employee;
use App\Models\PayrollBatch;
use App\Models\SalaryStructure;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PayrollItem extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hospital_id',
        'payroll_batch_id',
        'employee_id',
        'salary_structure_id',
        'slip_number',
        'base_salary',
        'allowances_total',
        'deductions_total',
        'attendance_days',
        'payable_days',
        'overtime_amount',
        'adjustments_amount',
        'final_amount',
        'status',
        'paid_at',
        'payment_method',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'base_salary' => 'decimal:2',
        'allowances_total' => 'decimal:2',
        'deductions_total' => 'decimal:2',
        'attendance_days' => 'decimal:2',
        'payable_days' => 'decimal:2',
        'overtime_amount' => 'decimal:2',
        'adjustments_amount' => 'decimal:2',
        'final_amount' => 'decimal:2',
        // 'date:Y-m-d', not 'date'. A plain date cast serialises through UTC, so
        // midnight in Kabul (+04:30) leaves as "...T19:30:00Z" and a client
        // reading the first ten characters gets the PREVIOUS day.
        'paid_at' => 'date:Y-m-d',
    ];

    public function batch()
    {
        return $this->belongsTo(PayrollBatch::class, 'payroll_batch_id');
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    public function salaryStructure()
    {
        return $this->belongsTo(SalaryStructure::class);
    }
}
