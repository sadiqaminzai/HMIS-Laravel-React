<?php

namespace App\Models\Reception;

use App\Models\General\Discount;
use App\Models\General\Employee;
use App\Models\General\Fee;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FeesReceipt extends Model
{
    use HasFactory;

    protected $table = 'fees_receipts';

    protected $fillable = [
        'patient_id',
        'doctor_id',
        'fees_id',
        'discount_amount',
        'total_amount',
        'payment_status',
        'payment_method',
        'receipt_date',
        'created_by',
        'updated_by',
        'deleted_by',
        'is_active',
        'is_delete'
    ];

    public function patient()
    {
        return $this->belongsTo(Patient::class, 'patient_id');
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class, 'doctor_id');
    }


    public function fees()
    {
        return $this->belongsTo(Fee::class, 'fees_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
