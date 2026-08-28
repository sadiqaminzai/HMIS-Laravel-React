<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Rights for the X-Ray desk.
 *
 * Modelled on the ultrasound set, including the split between taking a payment
 * and reversing one: whoever collects the cash must not also be able to make
 * the record of it disappear.
 *
 * Nothing is granted to any role here. A new desk that appeared already
 * enabled for everyone would widen access silently; an administrator assigns
 * these deliberately.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        ['view_xray_receipts', 'View X-Ray Receipts'],
        ['add_xray_receipts', 'Add X-Ray Receipt'],
        ['edit_xray_receipts', 'Edit X-Ray Receipt'],
        ['delete_xray_receipts', 'Delete X-Ray Receipt'],
        ['manage_xray_receipts', 'Manage X-Ray Receipts'],
        ['manage_xray_payments', 'Take X-Ray Payment'],
        ['reverse_xray_payment', 'Reverse X-Ray Payment'],
        ['print_xray_receipt', 'Print X-Ray Receipt'],
        // X-Ray posts to its own ledger module, so the day-end takings sheet
        // needs a line of its own -- and a permission to reveal it, matching
        // view_dashboard_ultrasound_fees beside it.
        ['view_dashboard_xray_fees', 'Dashboard: X-Ray Fees'],
    ];

    public function up(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        foreach (self::PERMISSIONS as [$name, $displayName]) {
            if (DB::table('permissions')->where('name', $name)->exists()) {
                continue;
            }

            DB::table('permissions')->insert([
                'name' => $name,
                'guard_name' => 'web',
                'display_name' => $displayName,
                'category' => 'Radiology',
                'status' => 'active',
                'is_system' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        $ids = DB::table('permissions')
            ->whereIn('name', array_column(self::PERMISSIONS, 0))
            ->pluck('id');

        if ($ids->isEmpty()) {
            return;
        }

        foreach (['role_has_permissions', 'model_has_permissions'] as $pivot) {
            if (Schema::hasTable($pivot)) {
                DB::table($pivot)->whereIn('permission_id', $ids)->delete();
            }
        }

        DB::table('permissions')->whereIn('id', $ids)->delete();
    }
};
