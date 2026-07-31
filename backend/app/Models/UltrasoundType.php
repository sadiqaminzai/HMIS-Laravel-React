<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class UltrasoundType extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hospital_id',
        'name',
        'code',
        'description',
        'default_template',
        'price',
        'sort_order',
        'is_active',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'price' => 'decimal:2',
        'sort_order' => 'integer',
    ];

    public function exams()
    {
        return $this->hasMany(UltrasoundExam::class);
    }
}
