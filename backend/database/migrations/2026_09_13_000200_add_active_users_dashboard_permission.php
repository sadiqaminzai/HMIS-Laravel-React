<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Who may see which staff are currently signed in.
 *
 * Kept separate from view_users: a list of accounts is administrative, while
 * "who is at their desk right now" is closer to supervision and not every
 * account that may edit users should be watching colleagues.
 */
return new class extends Migration
{
    private const PERMISSION = 'view_dashboard_active_users';

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
            'display_name' => 'Dashboard: Logged-in Users',
            'category' => 'Dashboard',
            'created_at' => now(),
            'updated_at' => now(),
        ];

        if (Schema::hasColumn('permissions', 'guard_name')) $row['guard_name'] = 'web';
        if (Schema::hasColumn('permissions', 'status')) $row['status'] = 'active';
        if (Schema::hasColumn('permissions', 'is_system')) $row['is_system'] = 1;
        if (Schema::hasColumn('permissions', 'description')) {
            $row['description'] = 'See which staff are currently signed in, per hospital';
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
