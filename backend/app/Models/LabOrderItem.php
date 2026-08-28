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

    /**
     * Always carried so every endpoint that returns an item also tells the
     * client whether the laboratory owes a result for it, without each of the
     * ten load() call sites having to remember to ask for it.
     */
    protected $with = ['template:id,requires_result'];

    protected $appends = ['requires_result'];

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

    /**
     * Whether the laboratory has to key a result for this test.
     *
     * Read live from the template rather than snapshotted onto the item, so
     * that switching a test over to machine-printed reports also clears the
     * orders already sitting in the technician's queue.
     *
     * Defaults to true when the template has been deleted -- an item nobody can
     * classify is safer left visible than silently dropped.
     */
    public function getRequiresResultAttribute(): bool
    {
        return $this->requiresResult();
    }

    public function requiresResult(): bool
    {
        $template = $this->relationLoaded('template') ? $this->template : $this->template()->first();

        return $template === null || (bool) $template->requires_result;
    }

    // Check if all results are entered
    public function allResultsEntered(): bool
    {
        return $this->results()->whereNull('result_value')->count() === 0;
    }
}
