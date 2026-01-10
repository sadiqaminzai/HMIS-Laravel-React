<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LabOrderItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'lab_order_id',
        'test_template_id',
        'test_code',
        'test_name',
        'test_type',
        'sample_type',
        'price',
        'status',
        'started_at',
        'completed_at',
        'completed_by',
        'remarks',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(LabOrder::class, 'lab_order_id');
    }

    public function template()
    {
        return $this->belongsTo(TestTemplate::class, 'test_template_id');
    }

    public function results()
    {
        return $this->hasMany(LabOrderResult::class);
    }

    // Check if all results are entered
    public function allResultsEntered(): bool
    {
        return $this->results()->whereNull('result_value')->count() === 0;
    }
}
