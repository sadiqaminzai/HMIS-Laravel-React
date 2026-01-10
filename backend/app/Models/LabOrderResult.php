<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class LabOrderResult extends Model
{
    use HasFactory;

    protected $fillable = [
        'lab_order_item_id',
        'parameter_id',
        'parameter_name',
        'unit',
        'normal_range',
        'result_value',
        'result_status',
        'remarks',
        'entered_by',
        'entered_at',
    ];

    protected $casts = [
        'entered_at' => 'datetime',
    ];

    public function item()
    {
        return $this->belongsTo(LabOrderItem::class, 'lab_order_item_id');
    }

    public function parameter()
    {
        return $this->belongsTo(TestTemplateParameter::class, 'parameter_id');
    }

    // Determine result status based on normal range
    public function determineStatus(): ?string
    {
        if (!$this->result_value || !$this->normal_range) {
            return null;
        }

        // Try to parse numeric value
        $value = floatval($this->result_value);

        // Parse normal range (e.g., "10-20", "< 100", "> 50")
        $range = trim($this->normal_range);

        // Range format: "min-max"
        if (preg_match('/^([\d.]+)\s*-\s*([\d.]+)$/', $range, $matches)) {
            $min = floatval($matches[1]);
            $max = floatval($matches[2]);

            if ($value < $min) {
                return $value < ($min * 0.7) ? 'critical' : 'low';
            }
            if ($value > $max) {
                return $value > ($max * 1.3) ? 'critical' : 'high';
            }
            return 'normal';
        }

        return null;
    }
}
