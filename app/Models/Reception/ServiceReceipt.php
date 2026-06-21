<?php

namespace App\Models\Reception;

use App\Models\General\Employee;
use App\Models\General\Service;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ServiceReceipt extends Model
{
    use HasFactory;

    protected $fillable = [
        'patient_id',
        'doctor_id',
        'discount',
        'discount_amount',
        'discount_reason',
        'total_amount',
        'net_amount',
        'paid_amount',
        'due_amount',
        'payment_status',
        'payment_method',
        'lab_test_status',
        'receipt_date',
        'created_by',
        'updated_by',
        'deleted_by',
        'is_active',
        'is_delete',
    ];

    public function service_receipt_details()
    {
        return $this->hasMany(ServiceReceiptDetail::class, 'service_receipt_id');
    }

    public function patient()
    {
        return $this->belongsTo(Patient::class, 'patient_id');
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class, 'doctor_id');
    }


    public function service()
    {
        return $this->belongsTo(Service::class, 'service_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
