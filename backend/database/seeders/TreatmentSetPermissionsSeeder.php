<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

class TreatmentSetPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        $permissions = [
            ['name' => 'view_treatment_sets', 'display_name' => 'View Treatment Sets', 'category' => 'Prescription'],
            ['name' => 'add_treatment_sets', 'display_name' => 'Add Treatment Sets', 'category' => 'Prescription'],
            ['name' => 'edit_treatment_sets', 'display_name' => 'Edit Treatment Sets', 'category' => 'Prescription'],
            ['name' => 'delete_treatment_sets', 'display_name' => 'Delete Treatment Sets', 'category' => 'Prescription'],
            ['name' => 'export_treatment_sets', 'display_name' => 'Export Treatment Sets', 'category' => 'Prescription'],
            ['name' => 'print_treatment_sets', 'display_name' => 'Print Treatment Sets', 'category' => 'Prescription'],
            ['name' => 'import_treatment_sets', 'display_name' => 'Import Treatment Sets', 'category' => 'Prescription'],
            ['name' => 'manage_treatment_sets', 'display_name' => 'Manage Treatment Sets', 'category' => 'Prescription'],
        ];

        foreach ($permissions as $permissionData) {
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
}
