<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Spatie\Permission\Models\Role as SpatieRole;
use App\Models\Traits\Sequenceable;

class Role extends SpatieRole
{
    use HasFactory, Sequenceable;

    protected static $sequenceModule = 'role';
    protected static $sequenceColumn = 'serial_no';

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
