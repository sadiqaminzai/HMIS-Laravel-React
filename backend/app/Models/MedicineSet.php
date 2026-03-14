<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\MedicineSetItem;

class MedicineSet extends Model
{
    use HasFactory;

    protected $fillable = [
        'hospital_id',
        'name',
        'description',
        'status',
        'created_by',
        'updated_by',
    ];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function items()
    {
        return $this->hasMany(MedicineSetItem::class)->orderBy('sort_order')->orderBy('id');
    }
}
