<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RoomBooking extends Model
{
    use HasFactory;

    protected $fillable = [
        'hospital_id',
        'room_id',
        'patient_id',
        'doctor_id',
        'booking_date',
        'check_in_date',
        'check_out_date',
        'bed_number',
        'beds_to_book',
        'total_cost',
        'discount_amount',
        'status',
        'payment_status',
        'remarks',
        'is_active',
        'is_delete',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'booking_date' => 'date',
        'check_in_date' => 'date',
        'check_out_date' => 'date',
        'beds_to_book' => 'integer',
        'total_cost' => 'decimal:2',
        'discount_amount' => 'decimal:2',
        'is_active' => 'boolean',
        'is_delete' => 'boolean',
    ];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function room()
    {
        return $this->belongsTo(Room::class);
    }

    public function patient()
    {
        return $this->belongsTo(Patient::class);
    }

    public function doctor()
    {
        return $this->belongsTo(User::class, 'doctor_id');
    }
}
