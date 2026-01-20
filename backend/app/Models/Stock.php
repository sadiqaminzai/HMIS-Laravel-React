<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Stock extends Model
{
    use HasFactory;

    protected $fillable = [
        'hospital_id',
        'medicine_id',
        'batch_no',
        'stock_qty',
    ];

    protected $casts = [
        'stock_qty' => 'integer',
    ];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function medicine()
    {
        return $this->belongsTo(Medicine::class);
    }
}
