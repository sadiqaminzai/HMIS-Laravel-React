<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

/**
 * Additive seeder for splitting pharmacy payment rights.
 *
 * Recording that money arrived and undoing that record shared
 * edit_finance_payment_status, so whoever could settle an invoice could also
 * make a settled one unpaid. Reversal now stands on its own.
 *
 * RolesPermissionsSeeder truncates RBAC tables and is fresh-install only, so
 * this needs its own additive seeder to reach an existing (production)
 * database without touching users, roles or assignments.
 */
class FinancePaymentPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        Permission::updateOrCreate(
            ['name' => 'reverse_finance_payment', 'guard_name' => 'web'],
            [
                'display_name' => 'Reverse Finance Payment (Paid to Pending)',
                'category' => 'Pharmacy Finance',
                'status' => 'active',
                'is_system' => true,
            ]
        );
    }
}
