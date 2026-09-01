<?php

namespace App\Models;

use App\Models\Department;
use App\Models\Designation;
use App\Models\EmployeeAttendance;
use App\Models\LeaveRequest;
use App\Models\PayrollItem;
use App\Models\SalaryStructure;
use App\Models\Shift;
use App\Models\User;
use App\Models\Traits\Sequenceable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Storage;

class Employee extends Model
{
    use HasFactory, SoftDeletes, Sequenceable;

    protected static $sequenceModule = 'employee';
    protected static $sequenceColumn = 'employee_code';

    protected $fillable = [
        'hospital_id',
        'user_id',
        'department_id',
        'designation_id',
        'shift_id',
        'employee_code',
        'first_name',
        'last_name',
        'gender',
        'date_of_birth',
        'phone',
        'email',
        'address',
        'emergency_contact_name',
        'emergency_contact_phone',
        'joining_date',
        'employment_type',
        'basic_salary',
        'status',
        'profile_image_path',
        'contract_document_path',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        // 'date:Y-m-d', not 'date'. A plain date cast serialises through UTC, so
        // midnight in Kabul (+04:30) leaves as "...T19:30:00Z" and a client
        // reading the first ten characters gets the PREVIOUS day.
        'date_of_birth' => 'date:Y-m-d',
        'joining_date' => 'date:Y-m-d',
        'basic_salary' => 'decimal:2',
    ];

    protected $appends = [
        'full_name',
        'profile_image_url',
        'contract_document_url',
    ];

    public function department()
    {
        return $this->belongsTo(Department::class);
    }

    public function designation()
    {
        return $this->belongsTo(Designation::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function shift()
    {
        return $this->belongsTo(Shift::class);
    }

    public function attendances()
    {
        return $this->hasMany(EmployeeAttendance::class);
    }

    public function leaveRequests()
    {
        return $this->hasMany(LeaveRequest::class);
    }

    public function salaryStructures()
    {
        return $this->hasMany(SalaryStructure::class);
    }

    public function payrollItems()
    {
        return $this->hasMany(PayrollItem::class);
    }

    public function getFullNameAttribute(): string
    {
        return trim(($this->first_name ?? '') . ' ' . ($this->last_name ?? ''));
    }

    public function getProfileImageUrlAttribute(): ?string
    {
        if (!$this->profile_image_path) {
            return null;
        }

        return url(Storage::url($this->profile_image_path));
    }

    public function getContractDocumentUrlAttribute(): ?string
    {
        if (!$this->contract_document_path) {
            return null;
        }

        return Storage::url($this->contract_document_path);
    }
}
