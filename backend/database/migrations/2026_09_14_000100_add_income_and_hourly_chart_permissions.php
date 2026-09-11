<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The two dashboard charts that had no permission of their own.
 *
 * Income by Module and Trend by Hour were added without matching rights, so
 * they could not be switched off for a role even though every panel beside
 * them could. Both show figures across the whole hospital, so they need the
 * same control as the tiles they summarise.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        'view_dashboard_chart_income' => [
            'Dashboard: Income by Module Chart',
            'See the income-by-module bar and donut chart',
        ],
        'view_dashboard_chart_hourly' => [
            'Dashboard: Trend by Hour Chart',
            'See the hour-by-hour activity chart',
        ],
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

        foreach (self::PERMISSIONS as $name => [$displayName, $description]) {
            if (in_array($name, $existing, true)) {
                continue;
            }

            $row = [
                'name' => $name,
                'display_name' => $displayName,
                'category' => 'Dashboard',
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
