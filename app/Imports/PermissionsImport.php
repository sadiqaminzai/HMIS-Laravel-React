<?php

namespace App\Imports;

use Spatie\Permission\Models\Permission;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class PermissionsImport implements ToModel, WithHeadingRow
{
    public function model(array $row)
    {
        // Check if the permission already exists by its name
        $existingPermission = Permission::where('name', $row['name'])->first();

        // If permission doesn't exist, create a new one
        if (!$existingPermission) {
            return new Permission([
                'name' => $row['name'],
                'group_name' => $row['group_name'],
            ]);
        }

        // Return null if permission already exists (no new record will be created)
        return null;
    }
}

