<?php

namespace Database\Seeders;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Database\Seeder;

class RolesPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            ['name' => 'manage_users', 'display_name' => 'Manage Users', 'category' => 'User Management'],
            ['name' => 'view_users', 'display_name' => 'View Users', 'category' => 'User Management'],
            ['name' => 'manage_doctors', 'display_name' => 'Manage Doctors', 'category' => 'User Management'],
            ['name' => 'manage_patients', 'display_name' => 'Manage Patients', 'category' => 'Patient Management'],
            ['name' => 'register_patients', 'display_name' => 'Register Patients', 'category' => 'Patient Management'],
            ['name' => 'view_patients', 'display_name' => 'View Patients', 'category' => 'Patient Management'],
            ['name' => 'create_prescription', 'display_name' => 'Create Prescription', 'category' => 'Prescription'],
            ['name' => 'view_prescriptions', 'display_name' => 'View Prescriptions', 'category' => 'Prescription'],
            ['name' => 'manage_prescriptions', 'display_name' => 'Manage Prescriptions', 'category' => 'Prescription'],
            ['name' => 'manage_medicines', 'display_name' => 'Manage Medicines', 'category' => 'Pharmacy'],
            ['name' => 'view_medicines', 'display_name' => 'View Medicines', 'category' => 'Pharmacy'],
            ['name' => 'dispense_medicines', 'display_name' => 'Dispense Medicines', 'category' => 'Pharmacy'],
            ['name' => 'view_reports', 'display_name' => 'View Reports', 'category' => 'Reports'],
            ['name' => 'manage_reports', 'display_name' => 'Manage Reports', 'category' => 'Reports'],
            ['name' => 'schedule_appointments', 'display_name' => 'Schedule Appointments', 'category' => 'Appointments'],
            ['name' => 'manage_appointments', 'display_name' => 'Manage Appointments', 'category' => 'Appointments'],
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

        $roles = [
            'super_admin' => [
                'display_name' => 'Super Admin',
                'description' => 'Full system access across all hospitals',
                'permissions' => array_values($permissionIds),
            ],
            'admin' => [
                'display_name' => 'Admin',
                'description' => 'Hospital administrator with full hospital access',
                'permissions' => array_values($permissionIds),
            ],
            'doctor' => [
                'display_name' => 'Doctor',
                'description' => 'Medical doctor who creates prescriptions',
                'permissions' => [
                    $permissionIds['create_prescription'],
                    $permissionIds['view_patients'],
                    $permissionIds['view_medicines'],
                    $permissionIds['view_prescriptions'],
                ],
            ],
            'receptionist' => [
                'display_name' => 'Receptionist',
                'description' => 'Reception and front desk staff',
                'permissions' => [
                    $permissionIds['register_patients'],
                    $permissionIds['view_patients'],
                    $permissionIds['schedule_appointments'],
                ],
            ],
            'pharmacist' => [
                'display_name' => 'Pharmacist',
                'description' => 'Pharmacy staff who manages medicines',
                'permissions' => [
                    $permissionIds['manage_medicines'],
                    $permissionIds['dispense_medicines'],
                    $permissionIds['view_prescriptions'],
                ],
            ],
            'lab_technician' => [
                'display_name' => 'Lab Technician',
                'description' => 'Lab staff handling tests',
                'permissions' => [
                    $permissionIds['view_patients'],
                    $permissionIds['manage_appointments'],
                ],
            ],
        ];

        foreach ($roles as $name => $roleData) {
            $role = Role::updateOrCreate(
                ['name' => $name],
                [
                    'display_name' => $roleData['display_name'],
                    'description' => $roleData['description'],
                    'status' => 'active',
                    'is_system' => true,
                ]
            );
            $role->permissions()->sync($roleData['permissions']);
        }
    }
}
