<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Expense extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hospital_id',
        'expense_category_id',
        'sequence_id',
        'title',
        'amount',
        'expense_date',
        'payment_method',
        'reference',
        'document_path',
        'notes',
        'status',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        // 'date:Y-m-d', not 'date'. A plain date cast serialises through UTC, so
        // midnight in Kabul (+04:30) leaves as "...T19:30:00Z" and a client
        // reading the first ten characters gets the PREVIOUS day.
        'expense_date' => 'date:Y-m-d',
        'amount' => 'decimal:2',
    ];

    protected $appends = ['document_url'];

    public function category()
    {
        return $this->belongsTo(ExpenseCategory::class, 'expense_category_id');
    }

    public function getDocumentUrlAttribute()
    {
        if (!$this->document_path) {
            return null;
        }

        return \Storage::url($this->document_path);
    }
}
