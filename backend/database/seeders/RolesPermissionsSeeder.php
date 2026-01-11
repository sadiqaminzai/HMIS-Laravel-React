<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Permission;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

class RolesPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // Reset RBAC data (but keep hospitals and clinical data intact).
        // This matches the requirement: only the platform owner (Super Admin) is seeded.
        $isMySql = DB::getDriverName() === 'mysql';
        if ($isMySql) {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
        }

        try {
            if (Schema::hasTable('personal_access_tokens')) {
                DB::table('personal_access_tokens')->truncate();
            }
            if (Schema::hasTable('permission_role')) {
                DB::table('permission_role')->truncate();
            }
            if (Schema::hasTable('roles')) {
                DB::table('roles')->truncate();
            }
            if (Schema::hasTable('permissions')) {
                DB::table('permissions')->truncate();
            }
            if (Schema::hasTable('users')) {
                DB::table('users')->truncate();
            }
        } finally {
            if ($isMySql) {
                DB::statement('SET FOREIGN_KEY_CHECKS=1');
            }
        }

        $permissions = [
            ['name' => 'manage_roles', 'display_name' => 'Manage Roles', 'category' => 'RBAC'],
            ['name' => 'view_roles', 'display_name' => 'View Roles', 'category' => 'RBAC'],
            ['name' => 'manage_permissions', 'display_name' => 'Manage Permissions', 'category' => 'RBAC'],
            ['name' => 'view_permissions', 'display_name' => 'View Permissions', 'category' => 'RBAC'],
            ['name' => 'manage_hospitals', 'display_name' => 'Manage Hospitals', 'category' => 'Hospitals'],
            ['name' => 'view_hospitals', 'display_name' => 'View Hospitals', 'category' => 'Hospitals'],
            ['name' => 'manage_users', 'display_name' => 'Manage Users', 'category' => 'User Management'],
            ['name' => 'view_users', 'display_name' => 'View Users', 'category' => 'User Management'],
            ['name' => 'manage_doctors', 'display_name' => 'Manage Doctors', 'category' => 'User Management'],
            ['name' => 'manage_patients', 'display_name' => 'Manage Patients', 'category' => 'Patient Management'],
            ['name' => 'register_patients', 'display_name' => 'Register Patients', 'category' => 'Patient Management'],
            ['name' => 'view_patients', 'display_name' => 'View Patients', 'category' => 'Patient Management'],
            ['name' => 'view_doctors', 'display_name' => 'View Doctors', 'category' => 'User Management'],
            ['name' => 'view_appointments', 'display_name' => 'View Appointments', 'category' => 'Appointments'],
            ['name' => 'create_prescription', 'display_name' => 'Create Prescription', 'category' => 'Prescription'],
            ['name' => 'view_prescriptions', 'display_name' => 'View Prescriptions', 'category' => 'Prescription'],
            ['name' => 'manage_prescriptions', 'display_name' => 'Manage Prescriptions', 'category' => 'Prescription'],
            ['name' => 'manage_medicines', 'display_name' => 'Manage Medicines', 'category' => 'Pharmacy'],
            ['name' => 'view_medicines', 'display_name' => 'View Medicines', 'category' => 'Pharmacy'],
            ['name' => 'dispense_medicines', 'display_name' => 'Dispense Medicines', 'category' => 'Pharmacy'],
            ['name' => 'manage_manufacturers', 'display_name' => 'Manage Manufacturers', 'category' => 'Pharmacy'],
            ['name' => 'view_manufacturers', 'display_name' => 'View Manufacturers', 'category' => 'Pharmacy'],
            ['name' => 'manage_medicine_types', 'display_name' => 'Manage Medicine Types', 'category' => 'Pharmacy'],
            ['name' => 'view_medicine_types', 'display_name' => 'View Medicine Types', 'category' => 'Pharmacy'],
            ['name' => 'view_reports', 'display_name' => 'View Reports', 'category' => 'Reports'],
            ['name' => 'manage_reports', 'display_name' => 'Manage Reports', 'category' => 'Reports'],
            ['name' => 'schedule_appointments', 'display_name' => 'Schedule Appointments', 'category' => 'Appointments'],
            ['name' => 'manage_appointments', 'display_name' => 'Manage Appointments', 'category' => 'Appointments'],
            ['name' => 'view_test_templates', 'display_name' => 'View Test Templates', 'category' => 'Laboratory'],
            ['name' => 'manage_test_templates', 'display_name' => 'Manage Test Templates', 'category' => 'Laboratory'],
            ['name' => 'view_lab_orders', 'display_name' => 'View Lab Orders', 'category' => 'Laboratory'],
            ['name' => 'manage_lab_orders', 'display_name' => 'Manage Lab Orders', 'category' => 'Laboratory'],
            ['name' => 'enter_lab_results', 'display_name' => 'Enter Lab Results', 'category' => 'Laboratory'],
            ['name' => 'manage_lab_payments', 'display_name' => 'Manage Lab Payments', 'category' => 'Laboratory'],
            ['name' => 'view_contact_messages', 'display_name' => 'View Contact Messages', 'category' => 'Support'],
            ['name' => 'manage_contact_messages', 'display_name' => 'Manage Contact Messages', 'category' => 'Support'],
            ['name' => 'view_hospital_settings', 'display_name' => 'View Hospital Settings', 'category' => 'Settings'],
            ['name' => 'manage_hospital_settings', 'display_name' => 'Manage Hospital Settings', 'category' => 'Settings'],
        ];

        $permissionIds = [];
        foreach ($permissions as $perm) {
            $permission = Permission::updateOrCreate(
                ['name' => $perm['name']],
                [
                    'display_name' => $perm['display_name'],
                    'category' => $perm['category'],
                    'status' => 'active',
                    'is_system' => true,
                ]
            );
            $permissionIds[$perm['name']] = $permission->id;
        }

        // Seed only the platform owner.
        // Permissions for super_admin are granted implicitly in User::hasPermission().
        User::create([
            'hospital_id' => null,
            'name' => 'Super Admin',
            'email' => 'superadmin@shifaascript.com',
            'password' => Hash::make('admin123'),
            'role' => 'super_admin',
            'role_id' => null,
            'doctor_id' => null,
            'avatar_path' => null,
            'is_active' => true,
            'last_login_at' => now(),
        ]);
    }
}
