<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Rights over the ECG desk.
 *
 * Two families, matching Dental and X-Ray: one over the study catalogue and one
 * over the receipts, plus the collection and dashboard rights every revenue
 * module carries.
 *
 * Categories follow where those families live *now*, not where Dental put them
 * when it was written: collecting and reversing money sits under Accounts,
 * since the Cash Collection tab was folded into it, and every view_dashboard_*
 * right sits under Dashboard with its siblings.
 *
 * Nothing is granted here. These are handed out through the permissions CSV,
 * and super_admin bypasses the check anyway -- so the desk is invisible to
 * every existing role until somebody is given it, which is the right default
 * for a module no one has been trained on yet.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        // Study catalogue
        'view_ecg_services' => ['View ECG Services', 'See the ECG study catalogue', 'ECG'],
        'add_ecg_services' => ['Add ECG Service', 'Create a new ECG study', 'ECG'],
        'edit_ecg_services' => ['Edit ECG Service', 'Change an existing ECG study', 'ECG'],
        'delete_ecg_services' => ['Delete ECG Service', 'Remove an ECG study from the catalogue', 'ECG'],
        'manage_ecg_services' => ['Manage ECG Services', 'Full control of the ECG study catalogue', 'ECG'],

        // Receipts
        'view_ecg_receipts' => ['View ECG Receipts', 'See the ECG receipts list', 'ECG'],
        'add_ecg_receipts' => ['Add ECG Receipt', 'Raise a new ECG receipt', 'ECG'],
        'edit_ecg_receipts' => ['Edit ECG Receipt', 'Change an existing ECG receipt', 'ECG'],
        'delete_ecg_receipts' => ['Delete ECG Receipt', 'Remove an ECG receipt', 'ECG'],
        'manage_ecg_receipts' => ['Manage ECG Receipts', 'Full control of ECG receipts', 'ECG'],
        'print_ecg_receipt' => ['Print ECG Receipt', 'Print an ECG receipt', 'ECG'],

        // Money
        'manage_ecg_payments' => ['Collect ECG Payment', 'Take payment against an ECG receipt', 'Accounts'],
        'reverse_ecg_payment' => ['Reverse ECG Payment', 'Undo an ECG payment already taken', 'Accounts'],

        // Dashboard
        'view_dashboard_ecg_fees' => ['Dashboard: ECG Fees', 'See ECG income on the dashboard', 'Dashboard'],
        'view_dashboard_count_ecg' => ['Dashboard: ECG Count', 'See the ECG receipt count on the dashboard', 'Dashboard'],
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
