<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * One study in a hospital's X-Ray catalogue.
 *
 * Deliberately the same shape as UltrasoundType so the two radiology desks
 * stay interchangeable; the only difference is that an X-Ray study carries no
 * report template, because X-Ray produces a receipt rather than a report.
 */
class XrayType extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hospital_id',
        'name',
        'code',
        'description',
        'price',
        'sort_order',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'price' => 'decimal:2',
        'sort_order' => 'integer',
    ];

    public function receipts()
    {
        return $this->hasMany(XrayReceipt::class);
    }
}
