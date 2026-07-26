<?php

namespace App\Models;

use App\Models\OtherIncome;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class OtherIncomeCategory extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hospital_id',
        'name',
        'description',
        'status',
        'created_by',
        'updated_by',
    ];

    public function otherIncomes()
    {
        return $this->hasMany(OtherIncome::class);
    }
}
