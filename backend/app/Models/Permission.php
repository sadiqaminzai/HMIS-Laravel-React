<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Spatie\Permission\Models\Permission as SpatiePermission;

class Permission extends SpatiePermission
{
    use HasFactory;

    protected string $guard_name = 'web';

    protected $fillable = [
        'name',
        'guard_name',
        'display_name',
        'category',
        'description',
        'status',
        'is_system',
    ];

    protected $casts = [
        'is_system' => 'boolean',
    ];

}
