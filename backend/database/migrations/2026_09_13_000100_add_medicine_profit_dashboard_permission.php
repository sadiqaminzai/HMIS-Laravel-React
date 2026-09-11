<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Who may see the pharmacy's margin on the dashboard.
 *
 * Held apart from view_dashboard_medicine_sale on purpose: turnover is an
 * operational figure a counter supervisor may well need, while the margin on
 * it is commercially sensitive and usually an owner's business alone.
 */
return new class extends Migration
{
    private const PERMISSION = 'view_dashboard_medicine_profit';

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
            'display_name' => 'Dashboard: Medicine Sales Profit',
            'category' => 'Dashboard',
            'created_at' => now(),
            'updated_at' => now(),
        ];

        if (Schema::hasColumn('permissions', 'guard_name')) $row['guard_name'] = 'web';
        if (Schema::hasColumn('permissions', 'status')) $row['status'] = 'active';
        if (Schema::hasColumn('permissions', 'is_system')) $row['is_system'] = 1;
        if (Schema::hasColumn('permissions', 'description')) {
            $row['description'] = 'See the gross profit on medicine sales, and the cost of goods behind it';
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
