<?php

namespace App\Exports;

use Spatie\Permission\Models\Role;
use Maatwebsite\Excel\Concerns\FromCollection;
use Maatwebsite\Excel\Concerns\WithHeadings;

class RolesExport implements FromCollection, WithHeadings
{
    public function collection()
    {
        return Role::all(['name']);
    }

    public function headings(): array
    {
        return [
            'Name'
        ];
    }
}
