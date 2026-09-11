<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The last three Finance permissions move to Accounts, closing that tab.
 *
 * `add_discounts`, `edit_discounts` and `manage_discounts` are all that were
 * left under Finance once the dead screen rights were retired. They are still
 * live -- they decide whether a user may discount an appointment, surgery,
 * x-ray or dental receipt -- but leaving three checkboxes alone under a tab
 * named after a menu that no longer exists is worse than filing them with the
 * other money decisions.
 *
 * Label only. Nothing any role holds changes.
 */
return new class extends Migration
{
    private const PERMISSIONS = ['add_discounts', 'edit_discounts', 'manage_discounts'];

    public function up(): void
    {
        if (!Schema::hasTable('permissions') || !Schema::hasColumn('permissions', 'category')) {
            return;
        }

        DB::table('permissions')
            ->whereIn('name', self::PERMISSIONS)
            ->update(['category' => 'Accounts', 'updated_at' => now()]);
    }

    public function down(): void
    {
        if (!Schema::hasTable('permissions') || !Schema::hasColumn('permissions', 'category')) {
            return;
        }

        DB::table('permissions')
            ->whereIn('name', self::PERMISSIONS)
            ->update(['category' => 'Finance', 'updated_at' => now()]);
    }
};
