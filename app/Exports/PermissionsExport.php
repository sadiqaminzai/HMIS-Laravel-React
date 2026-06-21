<?php

namespace App\Exports;

use Spatie\Permission\Models\Permission;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;

class PermissionsExport implements FromCollection, WithHeadings
{
    public function collection()
    {
        // Get all permissions with the columns 'name' and 'group_name'
        return Permission::all(['name', 'group_name']);
    }

    public function headings(): array
    {
        return [
            'Name',
            'Group Name'
        ];
    }
}
