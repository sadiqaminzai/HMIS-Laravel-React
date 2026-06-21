<?php

namespace App\Imports;

use Spatie\Permission\Models\Role;
use Maatwebsite\Excel\Concerns\ToModel;
use Maatwebsite\Excel\Concerns\WithHeadingRow;

class RolesImport implements ToModel, WithHeadingRow
{
    public function model(array $row)
    {
        return new Role([
            'name' => $row['name'],
        ]);
    }
}
