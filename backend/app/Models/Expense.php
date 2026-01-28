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
        'expense_date' => 'date',
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
