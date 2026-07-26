<?php

namespace App\Models;

use App\Models\PayrollItem;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PayrollBatch extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hospital_id',
        'payroll_month',
        'status',
        'total_employees',
        'gross_amount',
        'deductions_amount',
        'net_amount',
        'currency',
        'generated_by',
        'approved_by',
        'posted_by',
        'generated_at',
        'approved_at',
        'posted_at',
        'notes',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'gross_amount' => 'decimal:2',
        'deductions_amount' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'generated_at' => 'datetime',
        'approved_at' => 'datetime',
        'posted_at' => 'datetime',
    ];

    public function items()
    {
        return $this->hasMany(PayrollItem::class);
    }
}
