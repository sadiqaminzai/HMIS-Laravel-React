<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The four radiology dashboard panels, filed where the other dashboard
 * permissions live.
 *
 * Ultrasound and X-Ray now have fee and count panels on the dashboard, but
 * only two of the four permissions existed -- and view_dashboard_xray_fees was
 * created by the X-Ray migration under category "Radiology", so it appeared on
 * the Radiology tab of the role editor instead of beside its siblings on the
 * Dashboard tab. Every other view_dashboard_* permission uses "Dashboard".
 *
 * Display names follow the existing convention: a fee panel is named for the
 * money it shows, a count panel ends in "Card".
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        ['view_dashboard_ultrasound_fees', 'Ultrasound Fees'],
        ['view_dashboard_xray_fees', 'X-Ray Fees'],
        ['view_dashboard_count_ultrasound', 'Ultrasound Card'],
        ['view_dashboard_count_xray', 'X-Ray Card'],
    ];

    public function up(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        $now = now();
        $hasGuard = Schema::hasColumn('permissions', 'guard_name');
        $hasStatus = Schema::hasColumn('permissions', 'status');
        $hasSystem = Schema::hasColumn('permissions', 'is_system');

        foreach (self::PERMISSIONS as [$name, $displayName]) {
            $existing = DB::table('permissions')->where('name', $name)->first();

            if ($existing) {
                // Only the filing changes -- an existing grant stays granted,
                // because the row keeps its id and its role assignments.
                DB::table('permissions')->where('id', $existing->id)->update([
                    'display_name' => $displayName,
                    'category' => 'Dashboard',
                    'updated_at' => $now,
                ]);
                continue;
            }

            $row = [
                'name' => $name,
                'display_name' => $displayName,
                'category' => 'Dashboard',
                'created_at' => $now,
                'updated_at' => $now,
            ];
            if ($hasGuard) $row['guard_name'] = 'web';
            if ($hasStatus) $row['status'] = 'active';
            if ($hasSystem) $row['is_system'] = 1;

            DB::table('permissions')->insert($row);
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        // The two fee permissions predate this migration, so only their filing
        // is put back; the two count permissions it created are removed.
        DB::table('permissions')
            ->where('name', 'view_dashboard_xray_fees')
            ->update(['category' => 'Radiology', 'display_name' => 'Dashboard: X-Ray Fees']);

        DB::table('permissions')
            ->whereIn('name', ['view_dashboard_count_ultrasound', 'view_dashboard_count_xray'])
            ->delete();
    }
};
