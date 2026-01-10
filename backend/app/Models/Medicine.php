<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Medicine extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hospital_id',
        'manufacturer_id',
        'medicine_type_id',
        'brand_name',
        'generic_name',
        'strength',
        'status',
    ];

    protected $casts = [];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function manufacturer()
    {
        return $this->belongsTo(Manufacturer::class);
    }

    public function medicineType()
    {
        return $this->belongsTo(MedicineType::class);
    }
}
