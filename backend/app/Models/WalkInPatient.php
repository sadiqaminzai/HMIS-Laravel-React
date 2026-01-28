<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\Sequenceable;

class WalkInPatient extends Model
{
    use HasFactory, Sequenceable;

    protected static $sequenceModule = 'walk_in_patient';
    protected static $sequenceColumn = 'serial_no';

    protected $fillable = [
        'hospital_id',
        'name',
        'age',
        'gender',
        'created_by',
    ];

    protected $casts = [
        'age' => 'integer',
    ];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }
}
