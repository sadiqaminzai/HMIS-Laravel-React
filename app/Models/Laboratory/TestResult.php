<?php

namespace App\Models\Laboratory;

use App\Models\General\Employee;
use App\Models\General\Service;
use App\Models\Reception\Patient;
use App\Models\Reception\ServiceReceipt;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TestResult extends Model
{
    use HasFactory;
    
    //use above field as fillable
    protected $fillable = [
        'patient_service_id',
        'reporting_date',
        'remarks',
        'created_by',
        'updated_by',
        'deleted_by',
        'is_active',
        'is_delete',
    ];

    public function patient()
    {
        return $this->belongsTo(Patient::class, 'patient_id');
    }

    public function service_receipt()
    {
        return $this->belongsTo(ServiceReceipt::class, 'service_receipt_id');
    }

    public function service()
    {
        return $this->belongsTo(Service::class, 'service_id');
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class, 'doctor_id');
    }

    public function test_result_details()
    {
        return $this->hasMany(TestResultDetails::class, 'test_result_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
