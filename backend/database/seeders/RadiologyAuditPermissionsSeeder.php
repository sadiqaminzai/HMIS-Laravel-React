<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

/**
 * Additive seeder for the Radiology and Audit Log permissions.
 *
 * RolesPermissionsSeeder truncates RBAC tables, so it can only be used on a
 * fresh install. This seeder is safe to run against an existing database to
 * backfill the new permissions without touching users, roles or assignments.
 */
class RadiologyAuditPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->permissions() as $permissionData) {
            Permission::updateOrCreate(
                [
                    'name' => $permissionData['name'],
                    'guard_name' => 'web',
                ],
                [
                    'display_name' => $permissionData['display_name'],
                    'category' => $permissionData['category'],
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
        $permissions = [
            ['name' => 'view_radiology_menu', 'display_name' => 'View Radiology Menu', 'category' => 'Navigation'],
            ['name' => 'manage_ultrasound_exams', 'display_name' => 'Manage Ultrasound Exams', 'category' => 'Radiology'],
            ['name' => 'manage_ultrasound_types', 'display_name' => 'Manage Ultrasound Report Templates', 'category' => 'Radiology'],
            ['name' => 'view_audit_logs', 'display_name' => 'View Audit Log', 'category' => 'Audit Log'],
            ['name' => 'export_audit_logs', 'display_name' => 'Export Audit Log', 'category' => 'Audit Log'],
            ['name' => 'print_audit_logs', 'display_name' => 'Print Audit Log', 'category' => 'Audit Log'],
            ['name' => 'manage_audit_logs', 'display_name' => 'Manage Audit Log', 'category' => 'Audit Log'],
        ];

        $actions = [
            'view' => 'View',
            'add' => 'Add',
            'edit' => 'Edit',
            'delete' => 'Delete',
            'export' => 'Export',
            'print' => 'Print',
            'import' => 'Import',
        ];

        $resources = [
            ['name' => 'ultrasound_exams', 'label' => 'Ultrasound Exams'],
            ['name' => 'ultrasound_types', 'label' => 'Ultrasound Report Templates'],
        ];

        foreach ($resources as $resource) {
            foreach ($actions as $action => $display) {
                $permissions[] = [
                    'name' => $action.'_'.$resource['name'],
                    'display_name' => $display.' '.$resource['label'],
                    'category' => 'Radiology',
                ];
            }
        }

        return $permissions;
    }
}
