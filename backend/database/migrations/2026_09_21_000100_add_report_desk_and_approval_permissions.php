<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Per-desk report rights, and the approve/reject right on the money registers.
 *
 * `view_reports` used to be all-or-nothing: holding it opened Pharmacy profit,
 * every doctor's takings and the whole expense book alike. A pharmacist who
 * needs the low-stock report should not thereby see what the hospital spends,
 * so each desk under Reports is now its own permission, and the six pharmacy
 * reports -- which are genuinely different reports rather than groupings of one
 * -- get a permission each as well.
 *
 * `view_reports` is KEPT and still opens everything. Existing roles carry it,
 * and a migration that silently removed reporting from everyone who had it
 * would be a worse outcome than a broad grant. The new rights are the fine
 * grain to grant instead; nothing has to be regranted for the app to keep
 * working.
 *
 * The clinical desks' tabs (Detail / Doctor Wise / Date Wise / Service Wise)
 * deliberately get NO separate permission: they are four arrangements of the
 * same rows, so a right to see one is a right to see all four, and inventing
 * sixteen permissions that can never meaningfully differ only makes the roles
 * screen harder to read.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        // One per Reports sub-menu.
        ['view_reports_general', 'Reports: General', 'The overall financial and fee reports'],
        ['view_reports_pharmacy', 'Reports: Pharmacy', 'The pharmacy reporting desk'],
        ['view_reports_reception', 'Reports: Reception', 'The reception reporting desk'],
        ['view_reports_laboratory', 'Reports: Laboratory', 'The laboratory reporting desk'],
        ['view_reports_surgery', 'Reports: Surgery', 'Operations performed, by period, doctor and procedure'],
        ['view_reports_room_booking', 'Reports: Room Booking', 'Admissions and bed charges'],
        ['view_reports_xray', 'Reports: X-Ray', 'Films taken and fees collected'],
        ['view_reports_ultrasound', 'Reports: Ultrasound', 'Scans performed and fees collected'],
        ['view_reports_expenses', 'Reports: Expenses', 'What the hospital spent, by period and category'],
        ['view_reports_other_income', 'Reports: Other Income', 'Income raised outside the clinical modules'],

        // One per pharmacy report tab. These are separate reports, not
        // groupings: stock on hand, buying, selling, expiry, reordering and
        // margin answer different questions to different people.
        ['view_reports_pharmacy_stock', 'Reports: Available Stock', 'Stock on hand, product or company wise'],
        ['view_reports_pharmacy_purchase', 'Reports: Purchase', 'What was bought, supplier and date wise'],
        ['view_reports_pharmacy_sales', 'Reports: Sales', 'What was sold, customer and date wise'],
        ['view_reports_pharmacy_expiry', 'Reports: Short Expiry', 'Batches expiring, and stock already expired'],
        ['view_reports_pharmacy_low_stock', 'Reports: Low Stock', 'Products at or below their reorder level'],
        ['view_reports_pharmacy_profit', 'Reports: Profit', 'Revenue, cost of sales and margin per product'],

        // Approving or rejecting an expense is a supervisor's act, distinct
        // from being able to type one in.
        ['approve_expenses', 'Approve Expenses', 'Approve or reject a submitted expense'],
        ['approve_other_incomes', 'Approve Other Income', 'Approve or reject a submitted income entry'],
    ];

    public function up(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        foreach (self::PERMISSIONS as [$name, $displayName, $description]) {
            if (DB::table('permissions')->where('name', $name)->exists()) {
                continue;
            }

            $row = [
                'name' => $name,
                'display_name' => $displayName,
                'category' => str_starts_with($name, 'approve_') ? 'Accounts' : 'Reports',
                'created_at' => now(),
                'updated_at' => now(),
            ];

            // Columns are added by name rather than assumed: this table has
            // grown over several migrations and older deployments lack some.
            if (Schema::hasColumn('permissions', 'guard_name')) {
                $row['guard_name'] = 'web';
            }
            if (Schema::hasColumn('permissions', 'status')) {
                $row['status'] = 'active';
            }
            if (Schema::hasColumn('permissions', 'is_system')) {
                $row['is_system'] = 1;
            }
            if (Schema::hasColumn('permissions', 'description')) {
                $row['description'] = $description;
            }

            DB::table('permissions')->insert($row);
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        $names = array_column(self::PERMISSIONS, 0);

        // Role assignments go first, or the pivot keeps rows pointing at
        // permissions that no longer exist.
        if (Schema::hasTable('permission_role')) {
            $ids = DB::table('permissions')->whereIn('name', $names)->pluck('id');
            DB::table('permission_role')->whereIn('permission_id', $ids)->delete();
        }

        DB::table('permissions')->whereIn('name', $names)->delete();
    }
};
