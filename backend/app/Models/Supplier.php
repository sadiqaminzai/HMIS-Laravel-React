<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\Sequenceable;

class Supplier extends Model
{
    use HasFactory, Sequenceable;

    protected static $sequenceModule = 'supplier';
    protected static $sequenceColumn = 'serial_no';

    protected $fillable = [
        'hospital_id',
        'name',
        'contact_info',
        'address',
    ];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }
}
