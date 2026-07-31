<?php

namespace Database\Seeders;

use App\Models\User;
use App\Models\Permission;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

/**
 * DESTRUCTIVE: resets all RBAC data.
 *
 * This seeder truncates users, roles, permissions and every role/permission
 * assignment, then re-seeds the permission catalogue and a single Super Admin.
 * Hospitals and clinical data are left intact.
 *
 * It is intended for a fresh install only. Running it on a populated database
 * destroys every user account except the platform owner — which is exactly what
 * happened on 2026-07-30. It therefore refuses to run when RBAC data already
 * exists unless the reset is explicitly confirmed:
 *
 *   php artisan db:seed --class=RolesPermissionsSeeder            # prompts
 *   php artisan db:seed --class=RolesPermissionsSeeder --force    # still prompts
 *   RBAC_RESET=1 php artisan db:seed --class=RolesPermissionsSeeder   # no prompt
 *
 * To add new permissions to an existing database, write an additive seeder
 * instead (see RadiologyAuditPermissionsSeeder).
 */
class RolesPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        if (! $this->confirmDestructiveReset()) {
            return;
        }

        // Reset RBAC data (but keep hospitals and clinical data intact).
        // This matches the requirement: only the platform owner (Super Admin) is seeded.
        $isMySql = DB::getDriverName() === 'mysql';
        if ($isMySql) {
            DB::statement('SET FOREIGN_KEY_CHECKS=0');
        }

        try {
            if (Schema::hasTable('personal_access_tokens')) {
                DB::table('personal_access_tokens')->truncate();
            }
            if (Schema::hasTable('model_has_roles')) {
                DB::table('model_has_roles')->truncate();
            }
            if (Schema::hasTable('model_has_permissions')) {
                DB::table('model_has_permissions')->truncate();
            }
            if (Schema::hasTable('role_has_permissions')) {
                DB::table('role_has_permissions')->truncate();
            }
            if (Schema::hasTable('permission_role')) {
                DB::table('permission_role')->truncate();
            }
            if (Schema::hasTable('roles')) {
                DB::table('roles')->truncate();
            }
            if (Schema::hasTable('permissions')) {
                DB::table('permissions')->truncate();
            }
            if (Schema::hasTable('users')) {
                DB::table('users')->truncate();
            }
        } finally {
            if ($isMySql) {
                DB::statement('SET FOREIGN_KEY_CHECKS=1');
            }
        }

        $permissions = [
            ['name' => 'manage_roles', 'display_name' => 'Manage Roles', 'category' => 'RBAC'],
            ['name' => 'view_roles', 'display_name' => 'View Roles', 'category' => 'RBAC'],
            ['name' => 'manage_permissions', 'display_name' => 'Manage Permissions', 'category' => 'RBAC'],
            ['name' => 'view_permissions', 'display_name' => 'View Permissions', 'category' => 'RBAC'],
            ['name' => 'view_dashboard', 'display_name' => 'View Dashboard', 'category' => 'Navigation'],
            ['name' => 'view_dashboard_available_stock', 'display_name' => 'View Dashboard Available Stock', 'category' => 'Navigation'],
            ['name' => 'view_dashboard_medicine_sale', 'display_name' => 'View Dashboard Medicine Sale', 'category' => 'Navigation'],
            ['name' => 'view_dashboard_appointment_fees', 'display_name' => 'View Dashboard Appointment Fees', 'category' => 'Navigation'],
            ['name' => 'view_dashboard_lab_orders_amount', 'display_name' => 'View Dashboard Lab Orders Amount', 'category' => 'Navigation'],
            ['name' => 'view_dashboard_expenses', 'display_name' => 'View Dashboard Expenses', 'category' => 'Navigation'],
            ['name' => 'view_dashboard_revenue_total', 'display_name' => 'View Dashboard Revenue Total', 'category' => 'Navigation'],
            ['name' => 'view_reception_menu', 'display_name' => 'View Reception Menu', 'category' => 'Navigation'],
            ['name' => 'view_laboratory_menu', 'display_name' => 'View Laboratory Menu', 'category' => 'Navigation'],
            ['name' => 'view_pharmacy_menu', 'display_name' => 'View Pharmacy Menu', 'category' => 'Navigation'],
            ['name' => 'view_prescriptions_menu', 'display_name' => 'View Prescriptions Menu', 'category' => 'Navigation'],
            ['name' => 'view_radiology_menu', 'display_name' => 'View Radiology Menu', 'category' => 'Navigation'],
            ['name' => 'manage_hospitals', 'display_name' => 'Manage Hospitals', 'category' => 'Hospitals'],
            ['name' => 'view_hospitals', 'display_name' => 'View Hospitals', 'category' => 'Hospitals'],
            ['name' => 'manage_users', 'display_name' => 'Manage Users', 'category' => 'User Management'],
            ['name' => 'view_users', 'display_name' => 'View Users', 'category' => 'User Management'],
            ['name' => 'manage_doctors', 'display_name' => 'Manage Doctors', 'category' => 'User Management'],
            ['name' => 'manage_patients', 'display_name' => 'Manage Patients', 'category' => 'Patient Management'],
            ['name' => 'register_patients', 'display_name' => 'Register Patients', 'category' => 'Patient Management'],
            ['name' => 'view_patients', 'display_name' => 'View Patients', 'category' => 'Patient Management'],
            ['name' => 'view_doctors', 'display_name' => 'View Doctors', 'category' => 'User Management'],
            ['name' => 'view_appointments', 'display_name' => 'View Appointments', 'category' => 'Appointments'],
            ['name' => 'update_appointment_status', 'display_name' => 'Update Appointment Status', 'category' => 'Appointments'],
            ['name' => 'manage_appointment_payments', 'display_name' => 'Manage Appointment Payments', 'category' => 'Appointments'],
            ['name' => 'create_prescription', 'display_name' => 'Create Prescription', 'category' => 'Prescription'],
            ['name' => 'view_prescriptions', 'display_name' => 'View Prescriptions', 'category' => 'Prescription'],
            ['name' => 'manage_prescriptions', 'display_name' => 'Manage Prescriptions', 'category' => 'Prescription'],
            ['name' => 'manage_treatment_sets', 'display_name' => 'Manage Treatment Sets', 'category' => 'Prescription'],
            ['name' => 'manage_medicines', 'display_name' => 'Manage Medicines', 'category' => 'Pharmacy'],
            ['name' => 'view_medicines', 'display_name' => 'View Medicines', 'category' => 'Pharmacy'],
            ['name' => 'dispense_medicines', 'display_name' => 'Dispense Medicines', 'category' => 'Pharmacy'],
            ['name' => 'manage_manufacturers', 'display_name' => 'Manage Manufacturers', 'category' => 'Pharmacy'],
            ['name' => 'view_manufacturers', 'display_name' => 'View Manufacturers', 'category' => 'Pharmacy'],
            ['name' => 'manage_medicine_types', 'display_name' => 'Manage Medicine Types', 'category' => 'Pharmacy'],
            ['name' => 'view_medicine_types', 'display_name' => 'View Medicine Types', 'category' => 'Pharmacy'],
            ['name' => 'manage_suppliers', 'display_name' => 'Manage Suppliers', 'category' => 'Pharmacy'],
            ['name' => 'view_suppliers', 'display_name' => 'View Suppliers', 'category' => 'Pharmacy'],
            ['name' => 'manage_transactions', 'display_name' => 'Manage Transactions', 'category' => 'Pharmacy'],
            ['name' => 'view_transactions', 'display_name' => 'View Transactions', 'category' => 'Pharmacy'],
            ['name' => 'manage_stocks', 'display_name' => 'Manage Stocks', 'category' => 'Pharmacy'],
            ['name' => 'view_stocks', 'display_name' => 'View Stocks', 'category' => 'Pharmacy'],
            ['name' => 'manage_stock_reconciliation', 'display_name' => 'Manage Stock Reconciliation', 'category' => 'Pharmacy'],
            ['name' => 'view_stock_reconciliation', 'display_name' => 'View Stock Reconciliation', 'category' => 'Pharmacy'],
            ['name' => 'manage_expense_categories', 'display_name' => 'Manage Expense Categories', 'category' => 'Finance'],
            ['name' => 'view_expense_categories', 'display_name' => 'View Expense Categories', 'category' => 'Finance'],
            ['name' => 'manage_expenses', 'display_name' => 'Manage Expenses', 'category' => 'Finance'],
            ['name' => 'view_expenses', 'display_name' => 'View Expenses', 'category' => 'Finance'],
            ['name' => 'manage_other_income_categories', 'display_name' => 'Manage Other Income Categories', 'category' => 'Finance'],
            ['name' => 'view_other_income_categories', 'display_name' => 'View Other Income Categories', 'category' => 'Finance'],
            ['name' => 'manage_other_incomes', 'display_name' => 'Manage Other Incomes', 'category' => 'Finance'],
            ['name' => 'view_other_incomes', 'display_name' => 'View Other Incomes', 'category' => 'Finance'],
            ['name' => 'view_reports', 'display_name' => 'View Reports', 'category' => 'Reports'],
            ['name' => 'manage_reports', 'display_name' => 'Manage Reports', 'category' => 'Reports'],
            ['name' => 'schedule_appointments', 'display_name' => 'Schedule Appointments', 'category' => 'Appointments'],
            ['name' => 'manage_appointments', 'display_name' => 'Manage Appointments', 'category' => 'Appointments'],
            ['name' => 'view_test_templates', 'display_name' => 'View Test Templates', 'category' => 'Laboratory'],
            ['name' => 'manage_test_templates', 'display_name' => 'Manage Test Templates', 'category' => 'Laboratory'],
            ['name' => 'view_lab_orders', 'display_name' => 'View Lab Orders', 'category' => 'Laboratory'],
            ['name' => 'manage_lab_orders', 'display_name' => 'Manage Lab Orders', 'category' => 'Laboratory'],
            ['name' => 'lab_test_order_discount', 'display_name' => 'Lab Test Order Discount', 'category' => 'Laboratory'],
            // Without this, a user only sees lab orders whose payment is complete.
            ['name' => 'view_unpaid_lab_orders', 'display_name' => 'View Unpaid Lab Orders', 'category' => 'Laboratory'],
            ['name' => 'update_lab_order_status', 'display_name' => 'Update Lab Order Status', 'category' => 'Laboratory'],
            ['name' => 'enter_lab_results', 'display_name' => 'Enter Lab Results', 'category' => 'Laboratory'],
            ['name' => 'manage_lab_payments', 'display_name' => 'Manage Lab Payments', 'category' => 'Laboratory'],
            ['name' => 'manage_discounts', 'display_name' => 'Manage Discounts', 'category' => 'Finance'],
            // Controls who may change the hospital-wide print paper size.
            ['name' => 'manage_print_settings', 'display_name' => 'Manage Print Settings', 'category' => 'Settings'],
            ['name' => 'manage_rooms', 'display_name' => 'Manage Rooms', 'category' => 'Room Management'],
            ['name' => 'view_rooms', 'display_name' => 'View Rooms', 'category' => 'Room Management'],
            ['name' => 'manage_room_bookings', 'display_name' => 'Manage Room Bookings', 'category' => 'Room Management'],
            ['name' => 'view_room_bookings', 'display_name' => 'View Room Bookings', 'category' => 'Room Management'],
            ['name' => 'manage_surgery_types', 'display_name' => 'Manage Surgery Types', 'category' => 'Surgery Management'],
            ['name' => 'view_surgery_types', 'display_name' => 'View Surgery Types', 'category' => 'Surgery Management'],
            ['name' => 'manage_surgeries', 'display_name' => 'Manage Surgeries', 'category' => 'Surgery Management'],
            ['name' => 'view_surgeries', 'display_name' => 'View Surgeries', 'category' => 'Surgery Management'],
            ['name' => 'manage_patient_surgeries', 'display_name' => 'Manage Patient Surgeries', 'category' => 'Surgery Management'],
            ['name' => 'view_patient_surgeries', 'display_name' => 'View Patient Surgeries', 'category' => 'Surgery Management'],
            ['name' => 'manage_discharge_summaries', 'display_name' => 'Manage Discharge Summaries', 'category' => 'Surgery Management'],
            ['name' => 'view_discharge_summaries', 'display_name' => 'View Discharge Summaries', 'category' => 'Surgery Management'],
            ['name' => 'view_contact_messages', 'display_name' => 'View Contact Messages', 'category' => 'Support'],
            ['name' => 'manage_contact_messages', 'display_name' => 'Manage Contact Messages', 'category' => 'Support'],
            ['name' => 'view_hospital_settings', 'display_name' => 'View Hospital Settings', 'category' => 'Settings'],
            ['name' => 'manage_hospital_settings', 'display_name' => 'Manage Hospital Settings', 'category' => 'Settings'],
            ['name' => 'view_backups', 'display_name' => 'View Backups', 'category' => 'Settings'],
            ['name' => 'manage_backups', 'display_name' => 'Manage Backups', 'category' => 'Settings'],
            ['name' => 'view_ultrasound_exams', 'display_name' => 'View Ultrasound Exams', 'category' => 'Radiology'],
            ['name' => 'manage_ultrasound_exams', 'display_name' => 'Manage Ultrasound Exams', 'category' => 'Radiology'],
            ['name' => 'view_ultrasound_types', 'display_name' => 'View Ultrasound Report Templates', 'category' => 'Radiology'],
            ['name' => 'manage_ultrasound_types', 'display_name' => 'Manage Ultrasound Report Templates', 'category' => 'Radiology'],
            // Audit Log is read-only by design: entries are written by the
            // application, never by a user, so there is no add/edit/import.
            ['name' => 'view_finance_menu', 'display_name' => 'View Pharmacy Finance Menu', 'category' => 'Navigation'],
            ['name' => 'view_finance_sales', 'display_name' => 'View Invoice Finances', 'category' => 'Pharmacy Finance'],
            ['name' => 'view_finance_purchases', 'display_name' => 'View Purchase Finances', 'category' => 'Pharmacy Finance'],
            ['name' => 'view_finance_sales_returns', 'display_name' => 'View Return In Finances', 'category' => 'Pharmacy Finance'],
            ['name' => 'view_finance_purchase_returns', 'display_name' => 'View Return Out Finances', 'category' => 'Pharmacy Finance'],
            ['name' => 'record_finance_payments', 'display_name' => 'Record Payments', 'category' => 'Pharmacy Finance'],
            ['name' => 'edit_finance_payment_status', 'display_name' => 'Edit Payment Status & Terms', 'category' => 'Pharmacy Finance'],
            ['name' => 'export_finance', 'display_name' => 'Export Pharmacy Finance', 'category' => 'Pharmacy Finance'],
            ['name' => 'print_finance', 'display_name' => 'Print Pharmacy Finance', 'category' => 'Pharmacy Finance'],
            ['name' => 'manage_finance', 'display_name' => 'Manage Pharmacy Finance (Full Access)', 'category' => 'Pharmacy Finance'],
            ['name' => 'view_audit_logs', 'display_name' => 'View Audit Log', 'category' => 'Audit Log'],
            ['name' => 'export_audit_logs', 'display_name' => 'Export Audit Log', 'category' => 'Audit Log'],
            ['name' => 'print_audit_logs', 'display_name' => 'Print Audit Log', 'category' => 'Audit Log'],
            ['name' => 'manage_audit_logs', 'display_name' => 'Manage Audit Log', 'category' => 'Audit Log'],
        ];

        $permissions = $this->deduplicatePermissions(array_merge($permissions, $this->granularPermissions()));

        $permissionIds = [];
        foreach ($permissions as $perm) {
            $permission = Permission::updateOrCreate(
                ['name' => $perm['name'], 'guard_name' => 'web'],
                [
                    'display_name' => $perm['display_name'],
                    'category' => $perm['category'],
                    'status' => 'active',
                    'is_system' => true,
                ]
            );
            $permissionIds[$perm['name']] = $permission->id;
        }

        // Seed only the platform owner.
        // Permissions for super_admin are granted implicitly in User::hasPermission().
        User::create([
            'hospital_id' => null,
            'name' => 'Super Admin',
            'email' => 'superadmin@shifaascript.com',
            'password' => Hash::make('admin123'),
            'role' => 'super_admin',
            'role_id' => null,
            'doctor_id' => null,
            'avatar_path' => null,
            'is_active' => true,
            'last_login_at' => now(),
        ]);
    }

    /**
     * Guard the destructive reset when RBAC data already exists.
     *
     * Returns true when it is safe (or explicitly confirmed) to proceed.
     */
    private function confirmDestructiveReset(): bool
    {
        $existingUsers = Schema::hasTable('users') ? DB::table('users')->count() : 0;
        $existingRoles = Schema::hasTable('roles') ? DB::table('roles')->count() : 0;

        // Fresh install: nothing to lose.
        if ($existingUsers === 0 && $existingRoles === 0) {
            return true;
        }

        // Explicit opt-in for scripted/CI use.
        if (filter_var(env('RBAC_RESET', false), FILTER_VALIDATE_BOOLEAN)) {
            $this->command?->warn('RBAC_RESET is set — resetting RBAC data.');

            return true;
        }

        $this->command?->error('RolesPermissionsSeeder is DESTRUCTIVE and this database is not empty.');
        $this->command?->warn(sprintf(
            'It would delete %d user(s) and %d role(s), plus every role/permission assignment.',
            $existingUsers,
            $existingRoles
        ));
        $this->command?->line('Only the Super Admin would remain. Hospitals and clinical data are kept.');
        $this->command?->line('To add permissions without data loss, use an additive seeder instead.');

        // No console at all: never wipe silently.
        if (! $this->command) {
            return false;
        }

        // confirm() defaults to false, and returns that default without asking
        // when the run is non-interactive (CI, --no-interaction). So a scripted
        // `db:seed` is refused, while an operator at a terminal gets a prompt.
        if (! $this->command->confirm('Wipe all users and roles anyway?', false)) {
            $this->command->info('Skipped — no data was changed. Set RBAC_RESET=1 to force.');

            return false;
        }

        return true;
    }

    /**
     * @return array<int, array{name: string, display_name: string, category: string}>
     */
    private function granularPermissions(): array
    {
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
            ['name' => 'hospitals', 'label' => 'Hospitals', 'category' => 'Hospitals'],
            ['name' => 'users', 'label' => 'Users', 'category' => 'User Management'],
            ['name' => 'doctors', 'label' => 'Doctors', 'category' => 'User Management'],
            ['name' => 'patients', 'label' => 'Patients', 'category' => 'Patient Management'],
            ['name' => 'appointments', 'label' => 'Appointments', 'category' => 'Appointments'],
            ['name' => 'prescriptions', 'label' => 'Prescriptions', 'category' => 'Prescription'],
            ['name' => 'treatment_sets', 'label' => 'Treatment Sets', 'category' => 'Prescription'],
            ['name' => 'prescription_diagnoses', 'label' => 'Prescription Diagnoses', 'category' => 'Prescription'],
            ['name' => 'medicines', 'label' => 'Medicines', 'category' => 'Pharmacy'],
            ['name' => 'manufacturers', 'label' => 'Manufacturers', 'category' => 'Pharmacy'],
            ['name' => 'medicine_types', 'label' => 'Medicine Types', 'category' => 'Pharmacy'],
            ['name' => 'suppliers', 'label' => 'Suppliers', 'category' => 'Pharmacy'],
            ['name' => 'transactions', 'label' => 'Transactions', 'category' => 'Pharmacy'],
            ['name' => 'stocks', 'label' => 'Stocks', 'category' => 'Pharmacy'],
            ['name' => 'stock_reconciliation', 'label' => 'Stock Reconciliation', 'category' => 'Pharmacy'],
            ['name' => 'expense_categories', 'label' => 'Expense Categories', 'category' => 'Finance'],
            ['name' => 'expenses', 'label' => 'Expenses', 'category' => 'Finance'],
            ['name' => 'other_income_categories', 'label' => 'Other Income Categories', 'category' => 'Finance'],
            ['name' => 'other_incomes', 'label' => 'Other Incomes', 'category' => 'Finance'],
            // Kept after the discount catalog was removed: view_/add_/edit_/delete_discounts
            // still gate the manual discount fields on room bookings and lab orders.
            ['name' => 'discounts', 'label' => 'Discounts', 'category' => 'Finance'],
            ['name' => 'ledger', 'label' => 'Ledger', 'category' => 'Finance'],
            ['name' => 'rooms', 'label' => 'Rooms', 'category' => 'Room Management'],
            ['name' => 'room_bookings', 'label' => 'Room Bookings', 'category' => 'Room Management'],
            ['name' => 'surgery_types', 'label' => 'Surgery Types', 'category' => 'Surgery Management'],
            ['name' => 'surgeries', 'label' => 'Surgeries', 'category' => 'Surgery Management'],
            ['name' => 'patient_surgeries', 'label' => 'Patient Surgeries', 'category' => 'Surgery Management'],
            ['name' => 'discharge_summaries', 'label' => 'Discharge Summaries', 'category' => 'Surgery Management'],
            ['name' => 'reports', 'label' => 'Reports', 'category' => 'Reports'],
            ['name' => 'test_templates', 'label' => 'Test Templates', 'category' => 'Laboratory'],
            ['name' => 'lab_orders', 'label' => 'Lab Orders', 'category' => 'Laboratory'],
            ['name' => 'ultrasound_exams', 'label' => 'Ultrasound Exams', 'category' => 'Radiology'],
            ['name' => 'ultrasound_types', 'label' => 'Ultrasound Report Templates', 'category' => 'Radiology'],
            ['name' => 'contact_messages', 'label' => 'Contact Messages', 'category' => 'Support'],
            ['name' => 'hospital_settings', 'label' => 'Hospital Settings', 'category' => 'Settings'],
            ['name' => 'backups', 'label' => 'Backups', 'category' => 'Settings'],
            ['name' => 'roles', 'label' => 'Roles', 'category' => 'RBAC'],
            ['name' => 'permissions', 'label' => 'Permissions', 'category' => 'RBAC'],
        ];

        $permissions = [];

        foreach ($resources as $resource) {
            foreach ($actions as $action => $display) {
                $permissions[] = [
                    'name' => $action . '_' . $resource['name'],
                    'display_name' => $display . ' ' . $resource['label'],
                    'category' => $resource['category'],
                ];
            }
        }

        return $permissions;
    }

    /**
     * @param  array<int, array{name: string, display_name: string, category: string}>  $permissions
     * @return array<int, array{name: string, display_name: string, category: string}>
     */
    private function deduplicatePermissions(array $permissions): array
    {
        $deduplicated = [];

        foreach ($permissions as $permission) {
            $deduplicated[$permission['name']] = $permission;
        }

        return array_values($deduplicated);
    }
}
