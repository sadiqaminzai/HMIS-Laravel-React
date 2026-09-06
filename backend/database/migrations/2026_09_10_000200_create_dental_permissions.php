<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Rights over the dental desk.
 *
 * Two families, matching X-Ray: one over the service catalogue and one over
 * the receipts, plus the cash-collection and dashboard rights the other
 * revenue modules carry. Nothing is granted here -- these are handed out
 * through the permissions CSV, and super_admin bypasses the check anyway.
 */
return new class extends Migration
{
    /**
     * Categories match the ones the rest of the system already uses: every
     * view_dashboard_* right lives under Dashboard, and taking or reversing
     * money lives under Cash Collection. Filing these under 'Dental' instead
     * would scatter them away from their siblings on the permissions screen.
     */
    private const PERMISSIONS = [
        // Service catalogue
        'view_dental_services' => ['View Dental Services', 'See the dental service catalogue', 'Dental'],
        'add_dental_services' => ['Add Dental Service', 'Create a new dental service', 'Dental'],
        'edit_dental_services' => ['Edit Dental Service', 'Change an existing dental service', 'Dental'],
        'delete_dental_services' => ['Delete Dental Service', 'Remove a dental service from the catalogue', 'Dental'],
        'manage_dental_services' => ['Manage Dental Services', 'Full control of the dental service catalogue', 'Dental'],

        // Receipts
        'view_dental_receipts' => ['View Dental Receipts', 'See the dental receipts list', 'Dental'],
        'add_dental_receipts' => ['Add Dental Receipt', 'Raise a new dental receipt', 'Dental'],
        'edit_dental_receipts' => ['Edit Dental Receipt', 'Change an existing dental receipt', 'Dental'],
        'delete_dental_receipts' => ['Delete Dental Receipt', 'Remove a dental receipt', 'Dental'],
        'manage_dental_receipts' => ['Manage Dental Receipts', 'Full control of dental receipts', 'Dental'],
        'print_dental_receipt' => ['Print Dental Receipt', 'Print a dental receipt', 'Dental'],

        // Money
        'manage_dental_payments' => ['Collect Dental Payment', 'Take payment against a dental receipt', 'Cash Collection'],
        'reverse_dental_payment' => ['Reverse Dental Payment', 'Undo a dental payment already taken', 'Cash Collection'],

        // Dashboard
        'view_dashboard_dental_fees' => ['Dashboard: Dental Fees', 'See dental income on the dashboard', 'Dashboard'],
        'view_dashboard_count_dental' => ['Dashboard: Dental Count', 'See the dental receipt count on the dashboard', 'Dashboard'],
    ];

    public function up(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        $existing = DB::table('permissions')
            ->whereIn('name', array_keys(self::PERMISSIONS))
            ->pluck('name')
            ->all();

        $rows = [];

        foreach (self::PERMISSIONS as $name => [$displayName, $description, $category]) {
            if (in_array($name, $existing, true)) {
                continue;
            }

            $row = [
                'name' => $name,
                'display_name' => $displayName,
                'category' => $category,
                'created_at' => now(),
                'updated_at' => now(),
            ];

            if (Schema::hasColumn('permissions', 'guard_name')) $row['guard_name'] = 'web';
            if (Schema::hasColumn('permissions', 'status')) $row['status'] = 'active';
            if (Schema::hasColumn('permissions', 'is_system')) $row['is_system'] = 1;
            if (Schema::hasColumn('permissions', 'description')) $row['description'] = $description;

            $rows[] = $row;
        }

        if ($rows) {
            DB::table('permissions')->insert($rows);
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('permissions')) {
            DB::table('permissions')->whereIn('name', array_keys(self::PERMISSIONS))->delete();
        }
    }
};
