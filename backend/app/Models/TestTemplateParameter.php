<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TestTemplateParameter extends Model
{
    use HasFactory;

    protected $fillable = [
        'test_template_id',
        'name',
        'unit',
        'normal_range',
        'description',
        'sort_order',
    ];

    public function template()
    {
        return $this->belongsTo(TestTemplate::class, 'test_template_id');
    }
}
