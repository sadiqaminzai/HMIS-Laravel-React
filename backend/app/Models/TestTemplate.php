<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class TestTemplate extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hospital_id',
        'test_code',
        'test_name',
        'test_type',
        'category',
        'description',
        'sample_type',
        'price',
        'duration',
        'instructions',
        'status',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'price' => 'decimal:2',
    ];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function parameters()
    {
        return $this->hasMany(TestTemplateParameter::class)->orderBy('sort_order');
    }
}
