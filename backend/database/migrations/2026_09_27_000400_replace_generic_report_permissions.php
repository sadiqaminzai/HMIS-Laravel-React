<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One permission per report; the broad "Reports (General Rights)" set is gone.
 *
 * The per-desk and per-pharmacy-tab rights existed, but the reports API only
 * ever checked view_reports / manage_reports -- so a role given just "Low Stock"
 * saw the tab, asked the server, and was refused. The only rights that worked
 * were the broad ones, and they opened every report at once. The routes now
 * check the right for the report actually requested, so the broad set has
 * nothing left to do.
 *
 * Also added: view_reports_ecg, for the new ECG report desk.
 *
 * NO ROLE LOSES A REPORT. Before anything is deleted:
 *   - a role holding view_reports or manage_reports is granted EVERY report
 *     right, which is exactly what those two opened;
 *   - a role holding view_reports_pharmacy ("Pharmacy Desk, all tabs") is
 *     granted all six pharmacy tabs, which is exactly what that opened.
 * Only then are the broad rows deleted, taking their grants with them through
 * the ON DELETE CASCADE on role_has_permissions.
 *
 * Permission rows and role grants only. No report data exists to touch.
 */
return new class extends Migration
{
    private const DESKS = [
        'view_reports_general', 'view_reports_reception', 'view_reports_laboratory',
        'view_reports_surgery', 'view_reports_room_booking', 'view_reports_xray',
        'view_reports_ultrasound', 'view_reports_ecg', 'view_reports_expenses',
        'view_reports_other_income',
    ];

    private const PHARMACY_TABS = [
        'view_reports_pharmacy_stock', 'view_reports_pharmacy_purchase', 'view_reports_pharmacy_sales',
        'view_reports_pharmacy_expiry', 'view_reports_pharmacy_low_stock', 'view_reports_pharmacy_profit',
    ];

    private const BROAD = [
        'view_reports', 'manage_reports', 'add_reports', 'edit_reports',
        'delete_reports', 'export_reports', 'import_reports', 'print_reports',
    ];

    private const PHARMACY_DESK = 'view_reports_pharmacy';

    public function up(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        if (!DB::table('permissions')->where('name', 'view_reports_ecg')->exists()) {
            DB::table('permissions')->insert([
                'name' => 'view_reports_ecg',
                'guard_name' => 'web',
                'display_name' => 'Reports: ECG',
                'category' => 'Reports',
                'description' => 'Studies performed and fees collected at the ECG desk',
                'status' => 'active',
                'is_system' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if (Schema::hasTable('role_has_permissions')) {
            // What the two broad rights actually opened: every desk and tab.
            $this->grant(['view_reports', 'manage_reports'], array_merge(self::DESKS, self::PHARMACY_TABS));

            // What "Pharmacy Desk (all tabs)" opened.
            $this->grant([self::PHARMACY_DESK], self::PHARMACY_TABS);
        }

        // Deleting the permission cascades its grants away.
        DB::table('permissions')->whereIn('name', array_merge(self::BROAD, [self::PHARMACY_DESK]))->delete();
    }

    /** Every role holding any of $from also receives all of $to. */
    private function grant(array $from, array $to): void
    {
        $fromIds = DB::table('permissions')->whereIn('name', $from)->pluck('id');
        $toIds = DB::table('permissions')->whereIn('name', $to)->pluck('id');

        if ($fromIds->isEmpty() || $toIds->isEmpty()) {
            return;
        }

        $roleIds = DB::table('role_has_permissions')->whereIn('permission_id', $fromIds)->distinct()->pluck('role_id');

        foreach ($roleIds as $roleId) {
            $held = DB::table('role_has_permissions')->where('role_id', $roleId)->pluck('permission_id')->all();

            $rows = $toIds
                ->reject(fn ($id) => in_array($id, $held))
                ->map(fn ($id) => ['role_id' => $roleId, 'permission_id' => $id])
                ->values()
                ->all();

            if ($rows) {
                DB::table('role_has_permissions')->insert($rows);
            }
        }
    }

    /**
     * Recreates the broad rows so the old frontend can still resolve them, but
     * grants them to nobody: which roles held them was deleted with them, and
     * guessing would hand every report to roles that never had it. The
     * per-report grants made in up() are left in place, so nobody loses access
     * on the way back either.
     */
    public function down(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        foreach (array_merge(self::BROAD, [self::PHARMACY_DESK]) as $name) {
            if (DB::table('permissions')->where('name', $name)->exists()) {
                continue;
            }

            DB::table('permissions')->insert([
                'name' => $name,
                'guard_name' => 'web',
                'display_name' => ucwords(str_replace('_', ' ', $name)),
                'category' => 'Reports',
                'status' => 'active',
                'is_system' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $id = DB::table('permissions')->where('name', 'view_reports_ecg')->value('id');

        if ($id && Schema::hasTable('role_has_permissions')) {
            DB::table('role_has_permissions')->where('permission_id', $id)->delete();
        }

        DB::table('permissions')->where('name', 'view_reports_ecg')->delete();
    }
};
