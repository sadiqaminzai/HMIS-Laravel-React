<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Hospital extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'name',
        'slug',
        'code',
        'email',
        'phone',
        'address',
        'license',
        'license_issue_date',
        'license_expiry_date',
        'logo_path',
        'settings',
        'subscription_status',
        'status',
        'brand_color',
    ];

    protected $casts = [
        'settings' => 'array',
    ];
}
