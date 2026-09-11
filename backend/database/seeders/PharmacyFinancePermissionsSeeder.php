<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

/**
 * Additive seeder for the Pharmacy Finance permissions.
 *
 * Read access is granted per document type so financial visibility can be split
 * — e.g. a cashier settles patient invoices without seeing supplier purchase
 * figures — while the money-moving actions are separate permissions again.
 */
class PharmacyFinancePermissionsSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->permissions() as $permissionData) {
            Permission::updateOrCreate(
                ['name' => $permissionData['name'], 'guard_name' => 'web'],
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
    public static function permissions(): array
    {
        return [
            ['name' => 'manage_appointment_payments', 'display_name' => 'Manage Appointment Payments', 'category' => 'Appointments'],
            ['name' => 'view_finance_sales', 'display_name' => 'Sales Invoice', 'category' => 'Accounts'],
            ['name' => 'view_finance_purchases', 'display_name' => 'Purchase Invoice', 'category' => 'Accounts'],
            ['name' => 'view_finance_sales_returns', 'display_name' => 'Sales Return', 'category' => 'Accounts'],
            ['name' => 'view_finance_purchase_returns', 'display_name' => 'Purchase Return', 'category' => 'Accounts'],
            ['name' => 'record_finance_payments', 'display_name' => 'Record Payments', 'category' => 'Accounts'],
            ['name' => 'edit_finance_payment_status', 'display_name' => 'Edit Payment Status & Terms', 'category' => 'Accounts'],
            ['name' => 'manage_finance', 'display_name' => 'Manage Settlements (Full Access)', 'category' => 'Accounts'],
        ];
    }
}
