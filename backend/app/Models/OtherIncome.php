<?php

namespace App\Models;

use App\Models\OtherIncomeCategory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class OtherIncome extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hospital_id',
        'other_income_category_id',
        'sequence_id',
        'title',
        'amount',
        'income_date',
        'payment_method',
        'reference',
        'document_path',
        'notes',
        'status',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'income_date' => 'date',
        'amount' => 'decimal:2',
    ];

    protected $appends = ['document_url'];

    public function category()
    {
        return $this->belongsTo(OtherIncomeCategory::class, 'other_income_category_id');
    }

    public function getDocumentUrlAttribute()
    {
        if (!$this->document_path) {
            return null;
        }

        return Storage::url($this->document_path);
    }
}
