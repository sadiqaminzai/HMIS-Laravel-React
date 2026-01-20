<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Supplier extends Model
{
    use HasFactory;

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
