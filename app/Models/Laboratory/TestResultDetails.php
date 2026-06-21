<?php

namespace App\Models\Laboratory;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TestResultDetails extends Model
{
    use HasFactory;

    protected $fillable = [
        'test_result_id',
        'test_detail_id',
        'result_value',
        'description',
        'created_by',
        'updated_by',
        'deleted_by',
        'is_active',
        'is_delete',
    ];

    
    public function test_result()
    {
        return $this->belongsTo(TestResult::class, 'test_result_id');
    }

    public function test_detail()
    {
        return $this->belongsTo(TestDetail::class, 'test_detail_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
