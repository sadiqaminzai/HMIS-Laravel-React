<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * One study in a hospital's ECG catalogue.
 *
 * The name is the English study ("Resting ECG", "Stress ECG", "Holter 24h");
 * the description carries the hospital's own wording, typically Pashto, along
 * with any per-variant pricing note. Nothing here is seeded -- every hospital
 * builds and edits its own list through the CRUD screen.
 */
class EcgService extends Model
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
        return $this->hasMany(EcgReceipt::class);
    }
}
