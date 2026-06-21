<?php

namespace App\Models\General;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Employee extends Model
{
    use HasFactory;

    protected $fillable = [
        'first_name',
        'last_name',
        'employee_code',
        'department_id',
        'designation_id',
        'specialty',
        'experience_years',
        'email',
        'phone_number',
        'address',
        'hire_date',
        'is_active',
        'is_delete',
        'created_by',
        'updated_by',
        'deleted_by',
    ];

    public function Department()
    {
        return $this->belongsTo(Department::class,'department_id');
    }

    public function Designation()
    {
        return $this->belongsTo(Designation::class ,'designation_id');
    }

    public function Created_By()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function Updated_By()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function Deleted_By()
    {
        return $this->belongsTo(User::class, 'deleted_by');
    }
}
