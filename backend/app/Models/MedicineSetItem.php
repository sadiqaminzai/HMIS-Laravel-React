<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\MedicineSet;

class MedicineSetItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'medicine_set_id',
        'medicine_id',
        'medicine_name',
        'strength',
        'dose',
        'duration',
        'instruction',
        'quantity',
        'type',
        'sort_order',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'sort_order' => 'integer',
    ];

    public function medicineSet()
    {
        return $this->belongsTo(MedicineSet::class);
    }

    public function medicine()
    {
        return $this->belongsTo(Medicine::class);
    }
}
