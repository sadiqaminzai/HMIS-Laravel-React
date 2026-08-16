<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\Sequenceable;
use Illuminate\Support\Str;

class Transaction extends Model
{
    use HasFactory, Sequenceable;

    protected static $sequenceModule = 'transaction';
    protected static $sequenceColumn = 'serial_no';

    /**
     * Each document type is numbered on its own: Purchase #1, Sale #1, and so
     * on. A single shared counter produced gaps that looked like missing
     * paperwork to anyone reading a purchase book (Purchase 1, 3, 7...).
     */
    protected static $sequenceScopeColumn = 'trx_type';

    protected $fillable = [
        'hospital_id',
        'supplier_id',
        'supplier_name',
        'patient_id',
        'is_walk_in',
        'walk_in_patient_id',
        'patient_name',
        'trx_type',
        'grand_total',
        'total_discount',
        'total_tax',
        'paid_amount',
        'due_amount',
        'payment_status',
        'payment_method',
        'payment_reference',
        'payment_due_date',
        'last_payment_at',
        'finance_note',
        'settled_by',
        'verification_token',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_walk_in' => 'boolean',
        'grand_total' => 'decimal:2',
        'total_discount' => 'decimal:2',
        'total_tax' => 'decimal:2',
        'paid_amount' => 'decimal:2',
        'due_amount' => 'decimal:2',
        'payment_due_date' => 'date',
        'last_payment_at' => 'datetime',
    ];

    /** Document types that the Finance module reports on. */
    public const TYPES = ['sales', 'purchase', 'sales_return', 'purchase_return'];

    /**
     * A serial number retired by a deletion is never reissued.
     *
     * The number is printed on the copy the supplier or patient keeps, so
     * handing it to a different document later would leave two papers claiming
     * to be the same transaction. After deleting Purchase #2, the next purchase
     * is #4.
     */
    public function shouldDecrementSequenceOnDelete(): bool
    {
        return false;
    }

    /**
     * Recalculate due amount and payment status from the recorded totals.
     *
     * Kept on the model so both the operational and financial sides stay
     * consistent regardless of which one last touched the record.
     */
    public function syncPaymentState(): void
    {
        $total = round((float) $this->grand_total, 2);
        $paid = round((float) $this->paid_amount, 2);

        $this->due_amount = max(0, round($total - $paid, 2));

        if ($paid <= 0 && $total > 0) {
            $this->payment_status = 'pending';
        } elseif ($this->due_amount > 0) {
            $this->payment_status = 'partial';
        } else {
            $this->payment_status = 'paid';
        }
    }

    protected static function booted()
    {
        static::creating(function (Transaction $transaction) {
            if (empty($transaction->verification_token)) {
                $transaction->verification_token = (string) Str::uuid();
            }
        });
    }

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function supplier()
    {
        return $this->belongsTo(Supplier::class);
    }

    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    public function details()
    {
        return $this->hasMany(TransactionDetail::class, 'trx_id');
    }

    public function walkInPatient()
    {
        return $this->belongsTo(WalkInPatient::class, 'walk_in_patient_id');
    }
}
