<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Traits\Sequenceable;

class MedicineType extends Model
{
    use HasFactory, SoftDeletes, Sequenceable;

    protected static $sequenceModule = 'medicine_type';
    protected static $sequenceColumn = 'serial_no';

    protected $fillable = [
        'hospital_id',
        'name',
        'description',
        'status',
    ];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function medicines()
    {
        return $this->hasMany(Medicine::class);
    }
}
