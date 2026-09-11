<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Who may see how much of the period's billing has actually been collected.
 *
 * Separate from the individual desk permissions because it spans all of them:
 * the chart reads the ledger every receipt posts to, so it shows the hospital's
 * outstanding money in one figure. That is an owner's view, not a counter's.
 */
return new class extends Migration
{
    private const PERMISSION = 'view_dashboard_chart_collection';

    public function up(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        if (DB::table('permissions')->where('name', self::PERMISSION)->exists()) {
            return;
        }

        $row = [
            'name' => self::PERMISSION,
            'display_name' => 'Dashboard: Collection Status Chart',
            'category' => 'Dashboard',
            'created_at' => now(),
            'updated_at' => now(),
        ];

        if (Schema::hasColumn('permissions', 'guard_name')) $row['guard_name'] = 'web';
        if (Schema::hasColumn('permissions', 'status')) $row['status'] = 'active';
        if (Schema::hasColumn('permissions', 'is_system')) $row['is_system'] = 1;
        if (Schema::hasColumn('permissions', 'description')) {
            $row['description'] = 'See paid, partly paid and unpaid billing for the selected period';
        }

        DB::table('permissions')->insert($row);
    }

    public function down(): void
    {
        if (Schema::hasTable('permissions')) {
            DB::table('permissions')->where('name', self::PERMISSION)->delete();
        }
    }
};
