<?php

namespace App\Models\Reception;

use App\Models\General\Employee;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class RoomBooking extends Model
{
    use HasFactory;

    protected $fillable = [
        'room_id',
        'bed_number',
        'patient_id',
        'doctor_id',
        'check_in_date',
        'check_out_date',
        'total_cost',
        'discount_amount',
        'status',
        'payment_status',
        'is_active',
        'is_delete',
        'created_by',
        'updated_by'
    ];

    protected $casts = [
        'check_in_date' => 'date',
        'check_out_date' => 'date',
    ];

    public function room()
    {
        return $this->belongsTo(Room::class, 'room_id');
    }

    public function patient()
    {
        return $this->belongsTo(\App\Models\Reception\Patient::class, 'patient_id');
    }

    public function doctor()
    {
        return $this->belongsTo(Employee::class, 'doctor_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
    // adding relationship for udpteror 
    public function updater()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
    
}