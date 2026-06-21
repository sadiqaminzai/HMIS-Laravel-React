<?php

namespace App\Models\Reception;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    use HasFactory;

    protected $fillable = [
        'room_number',
        'type',
        'total_beds',
        'available_beds',
        'cost_per_bed',
        'is_active',
        'is_delete'
    ];

    public function bookings()
    {
        return $this->hasMany(RoomBooking::class, 'room_id');
    }
}