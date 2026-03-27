<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    use HasFactory;

    protected $fillable = [
        'hospital_id',
        'room_number',
        'type',
        'total_beds',
        'available_beds',
        'cost_per_bed',
        'is_active',
        'is_delete',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'total_beds' => 'integer',
        'available_beds' => 'integer',
        'cost_per_bed' => 'decimal:2',
        'is_active' => 'boolean',
        'is_delete' => 'boolean',
    ];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function bookings()
    {
        return $this->hasMany(RoomBooking::class);
    }
}
