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
        'payment_method',
        'paid_at',
        'paid_by',
        'remarks',
        'is_active',
        'is_delete',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    protected $casts = [
        'paid_at' => 'datetime',
        // 'date:Y-m-d', not 'date'. A plain date cast serialises through UTC,
        // so midnight in Kabul (+04:30) leaves as "2026-08-30T19:30:00Z" and a
        // client reading the first ten characters gets the PREVIOUS day. That
        // is the check-in landing a day early, and it walked back another day
        // each time a booking was opened and saved.
        'booking_date' => 'date:Y-m-d',
        'check_in_date' => 'date:Y-m-d',
        'check_out_date' => 'date:Y-m-d',
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
