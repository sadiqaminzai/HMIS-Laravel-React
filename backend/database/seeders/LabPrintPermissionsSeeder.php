<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

/**
 * Additive seeder for the permissions introduced alongside the lab-order
 * payment visibility rule and the per-module print paper sizes.
 *
 * RolesPermissionsSeeder truncates RBAC tables and is fresh-install only, so
 * these two permissions need their own additive seeder to reach an existing
 * (production) database without touching users, roles or assignments.
 */
class LabPrintPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->permissions() as $permission) {
            Permission::updateOrCreate(
                [
                    'name' => $permission['name'],
                    'guard_name' => 'web',
                ],
                [
                    'display_name' => $permission['display_name'],
                    'category' => $permission['category'],
                    'status' => 'active',
                    'is_system' => true,
                ]
            );
        }
    }

    /**
     * @return array<int, array{name: string, display_name: string, category: string}>
     */
    private function permissions(): array
    {
        return [
            // Without this, a user only sees lab orders whose payment is complete.
            [
                'name' => 'view_unpaid_lab_orders',
                'display_name' => 'View Unpaid Lab Orders',
                'category' => 'Laboratory',
            ],
            // Controls who may change the hospital-wide print paper sizes.
            [
                'name' => 'manage_print_settings',
                'display_name' => 'Manage Print Settings',
                'category' => 'Settings',
            ],
        ];
    }
}
