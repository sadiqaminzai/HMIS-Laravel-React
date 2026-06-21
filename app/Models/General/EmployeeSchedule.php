<?php

namespace App\Models\General;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeeSchedule extends Model
{
    use HasFactory;
protected $fillable=['employee_id', 'department_id', 'available_days', 'start_time', 'end_time', 'consultation_slot', 'is_active', 'is_delete', 'created_by', 'updated_by', 'deleted_by', 'created_at', 'updated_at', 'deleted_at'];
// defining relationships
public function Employee()
{
    return $this->belongsTo(Employee::class,'employee_id');

}
public function Department()
{
    return $this->belongsTo(Department::class,'department_id');


}
}
