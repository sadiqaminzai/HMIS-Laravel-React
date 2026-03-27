<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PrescriptionItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'prescription_id',
        'medicine_id',
        'medicine_name',
        'strength',
        'dose',
        'duration',
        'instruction',
        'quantity',
        'reserved_quantity',
        'dispensed_quantity',
        'dispensed_at',
        'type',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'reserved_quantity' => 'integer',
        'dispensed_quantity' => 'integer',
        'dispensed_at' => 'datetime',
    ];

    public function prescription()
    {
        return $this->belongsTo(Prescription::class);
    }

    public function medicine()
    {
        return $this->belongsTo(Medicine::class);
    }

    public function groupLink()
    {
        return $this->hasOne(PrescriptionItemGroupLink::class);
    }
}
