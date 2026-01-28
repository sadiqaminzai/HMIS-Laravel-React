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
use App\Models\Doctor;
use App\Models\Traits\Sequenceable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasApiTokens, HasFactory, Notifiable, SoftDeletes, HasRoles, Sequenceable {
        hasAnyPermission as spatieHasAnyPermission;
        hasPermissionTo as spatieHasPermissionTo;
    }

    protected static $sequenceModule = 'user';
    protected static $sequenceColumn = 'serial_no';

    protected string $guard_name = 'web';

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
        'phone',
        'specialization',
        'registration_number',
        'consultation_fee',
        'doctor_status',
        'availability_schedule',
        'image_path',
        'signature_path',
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
            'consultation_fee' => 'decimal:2',
            'availability_schedule' => 'array',
            'last_login_at' => 'datetime',
        ];
    }

    protected static function booted()
    {
        static::saved(function (User $user) {
            $user->syncDoctorProfile();
        });

        static::deleted(function (User $user) {
            if (!empty($user->doctor_id)) {
                Doctor::whereKey($user->doctor_id)->delete();
            }
        });
    }

    private function syncDoctorProfile(): void
    {
        if ($this->role !== 'doctor' || empty($this->hospital_id)) {
            if (!empty($this->doctor_id)) {
                Doctor::whereKey($this->doctor_id)->delete();
            }
            return;
        }

        $doctor = null;
        if (!empty($this->doctor_id)) {
            $doctor = Doctor::withTrashed()->find($this->doctor_id);
        }

        if (!$doctor) {
            $doctor = new Doctor();
        }

        $doctor->hospital_id = $this->hospital_id;
        $doctor->name = $this->name;
        $doctor->email = $this->email;
        $doctor->phone = $this->phone;
        $doctor->specialization = $this->specialization ?: 'General';
        $doctor->registration_number = $this->registration_number;
        $doctor->consultation_fee = $this->consultation_fee ?? 0;
        $doctor->status = $this->doctor_status ?? 'active';
        $doctor->availability_schedule = $this->availability_schedule;
        $doctor->image_path = $this->image_path;
        $doctor->signature_path = $this->signature_path;

        if ($doctor->exists && method_exists($doctor, 'trashed') && $doctor->trashed()) {
            $doctor->restore();
        }

        $doctor->save();

        if (empty($this->doctor_id) || (int) $this->doctor_id !== (int) $doctor->id) {
            $this->updateQuietly(['doctor_id' => $doctor->id]);
        }
    }

    public function getRoleAttribute($value): string
    {
        return strtolower(trim((string) ($value ?? '')));
    }

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
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
     * Legacy/system-role fallback.
     *
     * If a user has a built-in role name (admin/doctor/etc) but the RBAC tables
     * are not populated (or the user has no matching Role row), we still grant
     * a sensible baseline of permissions so hospital-scoped data can be viewed.
     *
     * @return array<int, string>
     */
    private function fallbackPermissionNamesForSystemRole(): array
    {
        $role = strtolower(trim((string) ($this->role ?? '')));
        if ($role === '') {
            return [];
        }

        // Keep these minimal and focused on the common built-in roles.
        // If a Role record exists in the DB, that will take precedence.
        return match ($role) {
            'admin' => [
                // Users/RBAC (within hospital)
                'view_users', 'manage_users',
                'view_roles', 'manage_roles',
                'view_permissions', 'manage_permissions',

                // Core clinical flows
                'view_doctors', 'manage_doctors',
                'view_patients', 'manage_patients', 'register_patients',
                'view_appointments', 'manage_appointments', 'schedule_appointments',
                'view_prescriptions', 'manage_prescriptions', 'create_prescription',

                // Pharmacy
                'view_medicines', 'manage_medicines', 'dispense_medicines',
                'view_manufacturers', 'manage_manufacturers',
                'view_medicine_types', 'manage_medicine_types',
                'view_suppliers', 'manage_suppliers',
                'view_transactions', 'manage_transactions',
                'view_stocks', 'manage_stocks',

                // Laboratory
                'view_test_templates', 'manage_test_templates',
                'view_lab_orders', 'manage_lab_orders',
                'enter_lab_results', 'manage_lab_payments',

                // Settings/Reports
                'view_hospital_settings', 'manage_hospital_settings',
                'view_reports', 'manage_reports',
            ],

            'doctor' => [
                'view_doctors',
                'view_patients',
                'view_appointments',
                'view_prescriptions', 'create_prescription',
                'view_test_templates',
                'view_lab_orders',
                'view_medicines',
            ],

            'receptionist' => [
                'view_doctors',
                'view_patients', 'register_patients',
                'view_appointments', 'schedule_appointments',
                'view_prescriptions',
            ],

            'pharmacist' => [
                'view_medicines', 'manage_medicines', 'dispense_medicines',
                'view_manufacturers',
                'view_medicine_types',
                'view_suppliers', 'manage_suppliers',
                'view_transactions', 'manage_transactions',
                'view_stocks', 'manage_stocks',
                'view_prescriptions',
            ],

            'lab' => [
                'view_test_templates',
                'view_lab_orders', 'manage_lab_orders',
                'enter_lab_results', 'manage_lab_payments',
            ],

            default => [],
        };
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

        $hasSpatieRoles = $this->roles()->exists();
        if ($hasSpatieRoles) {
            return $this->getAllPermissions()
                ->filter(fn ($perm) => !isset($perm->status) || $perm->status === 'active')
                ->pluck('name')
                ->values()
                ->all();
        }

        $role = $this->effectiveRoleRecord();
        if (!$role) {
            return $this->fallbackPermissionNamesForSystemRole();
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

        if ($this->roles()->exists()) {
            try {
                return $this->spatieHasPermissionTo($permissionName);
            } catch (\Throwable $e) {
                return false;
            }
        }

        $role = $this->effectiveRoleRecord();
        if (!$role) {
            return in_array($permissionName, $this->fallbackPermissionNamesForSystemRole(), true);
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

        if ($this->roles()->exists()) {
            return $this->spatieHasAnyPermission($names);
        }

        $role = $this->effectiveRoleRecord();
        if (!$role) {
            $fallback = $this->fallbackPermissionNamesForSystemRole();
            if (empty($fallback)) {
                return false;
            }
            return count(array_intersect($names, $fallback)) > 0;
        }

        return $role
            ->permissions()
            ->where('permissions.status', 'active')
            ->whereIn('permissions.name', $names)
            ->exists();
    }
}
