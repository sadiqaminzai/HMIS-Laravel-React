<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Spatie\Permission\Models\Role as SpatieRole;

class Role extends SpatieRole
{
    use HasFactory;

    protected string $guard_name = 'web';

    protected $fillable = [
        'hospital_id',
        'name',
        'guard_name',
        'display_name',
        'description',
        'status',
        'is_system',
    ];

    protected $casts = [
        'is_system' => 'boolean',
    ];

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }
}
