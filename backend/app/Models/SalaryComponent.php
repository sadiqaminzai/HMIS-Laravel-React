<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SalaryComponent extends Model
{
    use HasFactory;

    protected $fillable = [
        'hospital_id',
        'salary_structure_id',
        'component_type',
        'name',
        'amount',
        'is_taxable',
        'sort_order',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'is_taxable' => 'boolean',
    ];

    public function salaryStructure()
    {
        return $this->belongsTo(SalaryStructure::class);
    }
}
