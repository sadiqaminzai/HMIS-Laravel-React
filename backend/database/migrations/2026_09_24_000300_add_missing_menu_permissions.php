<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One Navigation permission per top-level sidebar group, granted to whoever
 * can already reach the group.
 *
 * Navigation listed six menus while the sidebar grew to eleven groups: Dental,
 * Accounts, Reports, HR and Hospitals appeared purely because the user held
 * something inside them, so the Navigation tab could not answer "which menus
 * does this role see" and hiding Reports meant revoking every report right one
 * at a time.
 *
 * The five that did exist were never enforced either -- Sidebar.tsx decided a
 * group by its children alone -- so this migration lands together with the fix
 * that makes the checkbox actually gate the menu. That fix is what makes the
 * backfill below necessary: every role keeps the menus it can see today,
 * worked out from the same rights the sidebar currently uses to decide.
 *
 * A group still disappears when none of its children are visible, so ticking a
 * menu on its own cannot produce an empty dropdown.
 */
return new class extends Migration
{
    /**
     * permission => [display label, ...rights that make the menu appear today]
     *
     * Deliberately in step with the `anyPermissions` arrays in Sidebar.tsx.
     */
    private const MENUS = [
        'view_dashboard' => ['Dashboard'],
        'view_reception_menu' => ['Reception',
            'view_doctors', 'manage_doctors', 'view_patients', 'manage_patients', 'register_patients',
            'view_appointments', 'manage_appointments', 'schedule_appointments',
            'view_rooms', 'manage_rooms', 'view_room_bookings', 'manage_room_bookings',
            'view_surgery_types', 'manage_surgery_types', 'view_surgeries', 'manage_surgeries',
            'view_patient_surgeries', 'manage_patient_surgeries',
        ],
        'view_laboratory_menu' => ['Laboratory',
            'view_lab_orders', 'manage_lab_orders', 'enter_lab_results', 'manage_lab_payments',
            'view_test_templates', 'manage_test_templates',
        ],
        'view_radiology_menu' => ['Radiology',
            'view_ultrasound_exams', 'add_ultrasound_receipt', 'submit_ultrasound_result',
            'delete_ultrasound_exams', 'manage_ultrasound_exams',
            'view_ultrasound_types', 'manage_ultrasound_types',
            'view_xray_receipts', 'add_xray_receipts', 'manage_xray_receipts',
            'manage_xray_payments', 'print_xray_receipt',
            'view_xray_types', 'manage_xray_types',
        ],
        'view_dental_menu' => ['Dental',
            'view_dental_receipts', 'add_dental_receipts', 'edit_dental_receipts',
            'delete_dental_receipts', 'manage_dental_receipts', 'manage_dental_payments',
            'print_dental_receipt', 'view_dental_services', 'add_dental_services',
            'edit_dental_services', 'delete_dental_services', 'manage_dental_services',
        ],
        'view_pharmacy_menu' => ['Pharmacy',
            'view_manufacturers', 'manage_manufacturers', 'view_medicine_types', 'manage_medicine_types',
            'view_medicines', 'manage_medicines', 'dispense_medicines',
            'view_suppliers', 'manage_suppliers',
            'view_transactions', 'manage_transactions',
            'view_stocks', 'manage_stocks', 'edit_stocks',
        ],
        'view_prescriptions_menu' => ['Prescriptions',
            'view_prescriptions', 'manage_prescriptions', 'create_prescription', 'add_prescriptions',
            'view_treatment_sets', 'manage_treatment_sets',
            'view_prescription_diagnoses', 'manage_prescription_diagnoses',
        ],
        'view_reports_menu' => ['Reports',
            'view_reports', 'manage_reports',
            'view_reports_general', 'view_reports_pharmacy', 'view_reports_reception',
            'view_reports_laboratory', 'view_reports_surgery', 'view_reports_room_booking',
            'view_reports_xray', 'view_reports_ultrasound', 'view_reports_expenses',
            'view_reports_other_income',
            // Patient History is the last entry under Reports and rides on the
            // patient rights, so a role holding only those still gets the menu.
            'view_patients', 'manage_patients', 'register_patients',
        ],
        'view_accounts_menu' => ['Accounts',
            'view_ledger', 'manage_ledger', 'export_ledger',
            'manage_appointment_payments', 'manage_lab_payments', 'manage_ultrasound_payments',
            'manage_surgery_payments', 'manage_room_booking_payments', 'record_finance_payments',
            'view_expenses', 'manage_expenses', 'view_expense_categories', 'manage_expense_categories',
            'view_other_incomes', 'manage_other_incomes',
            'view_other_income_categories', 'manage_other_income_categories',
        ],
        'view_hr_menu' => ['HR',
            'view_departments', 'manage_departments', 'view_designations', 'manage_designations',
            'view_shifts', 'manage_shifts', 'view_employees', 'manage_employees',
            'view_employee_attendances', 'manage_employee_attendances',
            'view_leave_requests', 'manage_leave_requests',
            'view_salary_structures', 'manage_salary_structures',
            'view_payroll_batches', 'manage_payroll_batches',
            'view_payroll_items', 'manage_payroll_items',
        ],
        'view_hospitals_menu' => ['Hospitals',
            'view_hospitals', 'manage_hospitals',
        ],
    ];

    /** Permissions this migration introduces; the rest already existed. */
    private const ADDED = [
        'view_dental_menu', 'view_reports_menu', 'view_accounts_menu',
        'view_hr_menu', 'view_hospitals_menu',
    ];

    public function up(): void
    {
        if (!Schema::hasTable('permissions') || !Schema::hasTable('role_has_permissions')) {
            return;
        }

        foreach (self::MENUS as $name => $config) {
            $label = array_shift($config);
            $impliedBy = $config;

            $id = DB::table('permissions')->where('name', $name)->value('id');

            if (!$id) {
                $id = DB::table('permissions')->insertGetId([
                    'name' => $name,
                    'guard_name' => 'web',
                    'display_name' => 'View ' . $label . ' Menu',
                    'category' => 'Navigation',
                    'description' => 'Show the ' . $label . ' menu in the sidebar',
                    'status' => 'active',
                    'is_system' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            if (!$impliedBy) {
                continue;
            }

            // Every role that can already reach this menu keeps it.
            $impliedIds = DB::table('permissions')->whereIn('name', $impliedBy)->pluck('id');

            if ($impliedIds->isEmpty()) {
                continue;
            }

            $roleIds = DB::table('role_has_permissions')
                ->whereIn('permission_id', $impliedIds)
                ->distinct()
                ->pluck('role_id');

            $held = DB::table('role_has_permissions')
                ->where('permission_id', $id)
                ->pluck('role_id')
                ->all();

            $missing = $roleIds->reject(function ($roleId) use ($held) {
                    return in_array($roleId, $held);
                })
                ->map(function ($roleId) use ($id) {
                    return ['role_id' => $roleId, 'permission_id' => $id];
                })
                ->values()
                ->all();

            if ($missing) {
                DB::table('role_has_permissions')->insert($missing);
            }
        }
    }

    /**
     * Drops only the five permissions this migration created.
     *
     * The backfilled grants on the six pre-existing menu permissions are left
     * alone: they reinstate access the sidebar was already giving, and undoing
     * them would hide menus rather than restore the previous state.
     */
    public function down(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        $ids = DB::table('permissions')->whereIn('name', self::ADDED)->pluck('id');

        if ($ids->isNotEmpty() && Schema::hasTable('role_has_permissions')) {
            DB::table('role_has_permissions')->whereIn('permission_id', $ids)->delete();
        }

        DB::table('permissions')->whereIn('name', self::ADDED)->delete();
    }
};
