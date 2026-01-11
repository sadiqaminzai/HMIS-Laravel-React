<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;
use App\Models\Permission;
use App\Models\Role;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'hospital_id',
        'name',
        'email',
        'password',
        'role',
        'role_id',
        'doctor_id',
        'avatar_path',
        'is_active',
        'last_login_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'is_active' => 'boolean',
            'last_login_at' => 'datetime',
        ];
    }

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function doctor()
    {
        return $this->belongsTo(Doctor::class);
    }

    public function roleRecord(): BelongsTo
    {
        return $this->belongsTo(Role::class, 'role_id');
    }

    private function effectiveRoleRecord(): ?Role
    {
        if ($this->relationLoaded('roleRecord') && $this->roleRecord) {
            return $this->roleRecord;
        }

        if (!empty($this->role_id)) {
            return $this->roleRecord;
        }

        if (!$this->hospital_id || !$this->role) {
            return null;
        }

        // Legacy fallback: older users may have role name stored in `role` but a null `role_id`.
        return Role::query()
            ->where('hospital_id', $this->hospital_id)
            ->where('name', $this->role)
            ->first();
    }

    /**
     * @return array<int, string>
     */
    public function permissionNames(): array
    {
        if ($this->role === 'super_admin') {
            return Permission::query()
                ->where('status', 'active')
                ->pluck('name')
                ->values()
                ->all();
        }

        $role = $this->effectiveRoleRecord();
        if (!$role) {
            return [];
        }

        return $role
            ->permissions()
            ->where('permissions.status', 'active')
            ->pluck('permissions.name')
            ->values()
            ->all();
    }

    public function hasPermission(string $permissionName): bool
    {
        if ($permissionName === '') {
            return false;
        }

        if ($this->role === 'super_admin') {
            return true;
        }

        $role = $this->effectiveRoleRecord();
        if (!$role) {
            return false;
        }

        return $role
            ->permissions()
            ->where('permissions.status', 'active')
            ->where('permissions.name', $permissionName)
            ->exists();
    }

    /**
     * @param  array<int, string>  $permissionNames
     */
    public function hasAnyPermission(array $permissionNames): bool
    {
        $names = array_values(array_filter(array_map('trim', $permissionNames), fn ($v) => $v !== ''));
        if (empty($names)) {
            return true;
        }

        if ($this->role === 'super_admin') {
            return true;
        }

        $role = $this->effectiveRoleRecord();
        if (!$role) {
            return false;
        }

        return $role
            ->permissions()
            ->where('permissions.status', 'active')
            ->whereIn('permissions.name', $names)
            ->exists();
    }
}
