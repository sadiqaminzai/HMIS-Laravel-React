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
        'completed_by_id',
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
     * May this user still correct the result on this item?
     *
     * A result belongs to the shift that produced it: the technician who
     * entered it may fix it the same day, and after that it is a closed record.
     * Anything else lets yesterday's figures change without a trace.
     *
     * completed_by_id is the test; the name is a fallback for rows submitted
     * before that column existed, so nothing already in flight locks early.
     */
    public function isEditableBy(?User $user): bool
    {
        if (!$user) {
            return false;
        }

        // Never submitted: this is a first entry, not an edit.
        if ($this->completed_at === null) {
            return true;
        }

        // A deliberately granted right to correct a closed record -- for the
        // error found the next morning, which would otherwise be permanent.
        // Held by nobody until a hospital grants it.
        if (method_exists($user, 'hasPermission') && $user->hasPermission('override_lab_result_lock')) {
            return true;
        }

        return $this->withinOwnEditWindow($user);
    }

    /**
     * Is this edit only possible because of the override?
     *
     * Reported alongside the row so a correction made outside the normal window
     * is visibly that, rather than passing as an ordinary same-day fix.
     */
    public function requiresLockOverride(?User $user): bool
    {
        if (!$user || $this->completed_at === null) {
            return false;
        }

        return !$this->withinOwnEditWindow($user);
    }

    /** The ordinary rule: the person who entered it, on the day they did. */
    private function withinOwnEditWindow(User $user): bool
    {
        if ($this->completed_at === null) {
            return true;
        }

        $sameUser = $this->completed_by_id !== null
            ? (int) $this->completed_by_id === (int) $user->id
            : (string) $this->completed_by === (string) $user->name;

        return $sameUser && $this->completed_at->isSameDay(now());
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
