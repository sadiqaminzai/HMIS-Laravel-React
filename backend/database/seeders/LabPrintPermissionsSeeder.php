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
        return array_merge([
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
            // Controls who may switch the hospital between registered-patient,
            // walk-in, or both for pharmacy sales.
            [
                'name' => 'manage_pharmacy_settings',
                'display_name' => 'Manage Pharmacy Settings',
                'category' => 'Settings',
            ],
            // Without this, the walk-in customer option is hidden from the
            // pharmacy sale screen even when the hospital enables it.
            // Assigning, generating and printing medicine barcodes.
            [
                'name' => 'manage_medicine_barcodes',
                'display_name' => 'Manage Medicine Barcodes',
                'category' => 'Pharmacy',
            ],
            [
                'name' => 'pharmacy_walk_in_sales',
                'display_name' => 'Pharmacy Walk-in Sales',
                'category' => 'Pharmacy',
            ],
            // Overriding a doctor's consultation fee moves money in the same way
            // a discount does, so reception can book without being able to
            // rewrite the price.
            [
                'name' => 'override_appointment_fee',
                'display_name' => 'Override Appointment Fee',
                'category' => 'Appointments',
            ],
        ], $this->dashboardPermissions());
    }

    /**
     * One permission per dashboard panel.
     *
     * The dashboard is the first screen every user sees and it aggregates
     * figures from every module -- revenue, payroll, stock value. Granting it
     * wholesale leaks numbers a role has no business seeing, so each tile,
     * chart and list is switched independently.
     *
     * They share the "Dashboard" category, which the permissions screen turns
     * into its own tab automatically.
     *
     * @return array<int, array{name: string, display_name: string, category: string}>
     */
    private function dashboardPermissions(): array
    {
        $panels = [
            // Financial tiles
            'available_stock' => 'Available Stock Value',
            'medicine_sale' => 'Medicine Sale',
            'appointment_fees' => 'Appointment Fees',
            'lab_orders_amount' => 'Lab Orders Amount',
            'surgery_fees' => 'Surgery Fees',
            'room_booking_fees' => 'Room Booking Fees',
            'expenses' => 'Expenses',
            'inventory_purchases' => 'Inventory Purchases',
            'other_income' => 'Other Income',
            'salary' => 'Salary',
            'revenue_total' => 'Revenue Total',
            // Count cards
            'count_hospitals' => 'Total Hospitals Card',
            'count_doctors' => 'Total Doctors Card',
            'count_patients' => 'Total Patients Card',
            'count_prescriptions' => 'Total Prescriptions Card',
            'count_medicines' => 'Total Medicines Card',
            'count_test_templates' => 'Test Templates Card',
            'count_lab_tests' => 'Lab Tests Card',
            'count_appointments' => 'Appointments Card',
            'count_rooms' => 'Rooms Card',
            'count_surgeries' => 'Surgeries Card',
            // Charts
            'chart_monthly' => 'Monthly Trends Chart',
            'chart_appointment_status' => 'Appointment Status Chart',
            'chart_test_status' => 'Test Status Chart',
            'chart_medicine_stock' => 'Medicine Stock Chart',
            // Recent activity lists
            'recent_patients' => 'Recent Patients List',
            'recent_prescriptions' => 'Recent Prescriptions List',
            'recent_lab_orders' => 'Recent Lab Orders List',
        ];

        $permissions = [];
        foreach ($panels as $key => $label) {
            $permissions[] = [
                'name' => 'view_dashboard_' . $key,
                'display_name' => $label,
                'category' => 'Dashboard',
            ];
        }

        return $permissions;
    }
}
