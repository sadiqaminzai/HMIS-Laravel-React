<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * One entry in a hospital's dental service catalogue.
 *
 * The name is the English service ("Root canal treatment"); the description
 * carries the hospital's own wording, typically Pashto, along with any
 * per-variant pricing note. Nothing here is seeded -- every hospital builds
 * and edits its own list through the CRUD screen.
 */
class DentalService extends Model
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
        return $this->hasMany(DentalReceipt::class);
    }
}
