<?php

namespace Database\Seeders;

use App\Models\Hospital;
use App\Models\Permission;
use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Permission\PermissionRegistrar;

class MultiRoleDemoSeeder extends Seeder
{
    public function run(): void
    {
        // Ensure a demo hospital exists for tenant-scoped roles
        $hospital = Hospital::firstOrCreate(
            ['slug' => 'demo-hospital'],
            [
                'name' => 'Demo Hospital',
                'email' => 'info@demo-hospital.com',
                'subscription_status' => 'active',
            ]
        );

        $users = [
            [
                'name' => 'Super Admin',
                'email' => 'superadmin@shifaascript.com',
                'role' => 'super_admin',
                'hospital_id' => null,
                'password' => 'admin123',
            ],
            [
                'name' => 'Admin User',
                'email' => 'admin@hospital.com',
                'role' => 'admin',
                'hospital_id' => $hospital->id,
                'password' => 'admin123',
            ],
            [
                'name' => 'Dr. Sarah Johnson',
                'email' => 'sarah.johnson@hospital.com',
                'role' => 'doctor',
                'hospital_id' => $hospital->id,
                'password' => 'doctor123',
            ],
            [
                'name' => 'Reception Desk',
                'email' => 'receptionist@hospital.com',
                'role' => 'receptionist',
                'hospital_id' => $hospital->id,
                'password' => 'reception123',
            ],
            [
                'name' => 'Pharmacy User',
                'email' => 'pharmacist@hospital.com',
                'role' => 'pharmacist',
                'hospital_id' => $hospital->id,
                'password' => 'pharmacy123',
            ],
            [
                'name' => 'Lab Tech',
                'email' => 'labtech@hospital.com',
                'role' => 'lab_technician',
                'hospital_id' => $hospital->id,
                'password' => 'lab123',
            ],
        ];

        $rolePermissions = [
            'admin' => [
                'view_dashboard',
                'view_reception_menu',
                'view_laboratory_menu',
                'view_pharmacy_menu',
                'view_prescriptions_menu',
                'view_users', 'manage_users',
                'view_roles', 'manage_roles',
                'view_permissions', 'manage_permissions',
                'view_doctors', 'manage_doctors',
                'view_patients', 'manage_patients', 'register_patients',
                'view_appointments', 'manage_appointments', 'schedule_appointments',
                'update_appointment_status',
                'view_prescriptions', 'manage_prescriptions', 'create_prescription',
                'view_medicines', 'manage_medicines', 'dispense_medicines',
                'view_manufacturers', 'manage_manufacturers',
                'view_medicine_types', 'manage_medicine_types',
                'view_suppliers', 'manage_suppliers',
                'view_transactions', 'manage_transactions',
                'view_stocks', 'manage_stocks',
                'view_stock_reconciliation', 'manage_stock_reconciliation',
                'view_test_templates', 'manage_test_templates',
                'view_lab_orders', 'manage_lab_orders',
                'update_lab_order_status',
                'enter_lab_results', 'manage_lab_payments',
                'view_hospital_settings', 'manage_hospital_settings',
                'view_backups', 'manage_backups',
                'view_reports', 'manage_reports',
            ],
            'doctor' => [
                'view_dashboard',
                'view_reception_menu',
                'view_laboratory_menu',
                'view_prescriptions_menu',
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
                'view_dashboard',
                'view_reception_menu',
                'view_prescriptions_menu',
                'update_appointment_status',
                'view_prescriptions',
            ],
            'pharmacist' => [
                'view_medicines', 'manage_medicines', 'dispense_medicines',
                'view_manufacturers',
                'view_dashboard',
                'view_pharmacy_menu',
                'view_prescriptions_menu',
                'view_medicine_types',
                'view_suppliers', 'manage_suppliers',
                'view_transactions', 'manage_transactions',
                'view_stocks', 'manage_stocks',
                'view_stock_reconciliation', 'manage_stock_reconciliation',
                'view_prescriptions',
            ],
            'lab_technician' => [
                'view_test_templates',
                'view_lab_orders', 'manage_lab_orders',
                'view_dashboard',
                'view_laboratory_menu',
                'update_lab_order_status',
                'enter_lab_results', 'manage_lab_payments',
            ],
        ];

        $guardName = 'web';
        $permissionMap = Permission::query()
            ->whereIn('name', collect($rolePermissions)->flatten()->unique()->all())
            ->get()
            ->keyBy('name');

        $roles = [];
        foreach ($rolePermissions as $roleName => $permissionNames) {
            $role = Role::updateOrCreate(
                ['name' => $roleName, 'hospital_id' => $hospital->id, 'guard_name' => $guardName],
                [
                    'display_name' => ucwords(str_replace('_', ' ', $roleName)),
                    'description' => 'System role',
                    'status' => 'active',
                    'is_system' => true,
                ]
            );

            app(PermissionRegistrar::class)->setPermissionsTeamId($hospital->id);
            $role->syncPermissions(collect($permissionNames)->map(fn ($name) => $permissionMap[$name] ?? null)->filter()->values());
            $roles[$roleName] = $role;
        }

        foreach ($users as $data) {
            $roleName = $data['role'] ?? null;
            $role = $roleName && isset($roles[$roleName]) ? $roles[$roleName] : null;

            $user = User::updateOrCreate(
                ['email' => $data['email']],
                [
                    'name' => $data['name'],
                    'hospital_id' => $data['hospital_id'],
                    'role' => $data['role'],
                    'role_id' => $role?->id,
                    'password' => $data['password'], // hashed by cast
                    'is_active' => true,
                ]
            );

            if ($role && $data['hospital_id']) {
                app(PermissionRegistrar::class)->setPermissionsTeamId($data['hospital_id']);
                $user->syncRoles([$role]);
            }
        }
    }
}
