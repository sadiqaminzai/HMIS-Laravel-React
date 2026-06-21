<?php

namespace App\Models\General;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeeDocument extends Model
{
    use HasFactory;
    protected $fillable=['employee_id', 'document_type', 'document_url', 'is_active', 'is_delete', 'created_by', 'updated_by','deleted_by', 'created_at', 'created_at', 'deleted_at'];
// defining relationships
        public function Employee()
        {
            return $this->belongsTo(Employee::class,'employee_id');
        }

}
