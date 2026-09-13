<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\PermissionRegistrar;

/**
 * Print Result and Download Result on the Lab Results tab.
 *
 * The printer and PDF icons on a completed result were gated by the Lab Orders
 * "Print" right -- the counter's receipt permission -- so a laboratory assistant
 * who entered and completed a result could not print it without also being
 * handed receipt printing.
 *
 * Backfilled from print_lab_orders so every role that sees those icons today
 * keeps them; nothing is taken away.
 *
 * Permission rows and role grants only. No lab order or result is touched.
 */
return new class extends Migration
{
    /** name => [display, description] */
    private const PERMISSIONS = [
        'print_lab_results' => ['Print Lab Result', 'Print the report of a completed lab result'],
        'download_lab_results' => ['Download Lab Result', 'Download a completed lab result as PDF'],
    ];

    private const SOURCE = 'print_lab_orders';

    public function up(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        $sourceId = DB::table('permissions')->where('name', self::SOURCE)->value('id');

        foreach (self::PERMISSIONS as $name => [$display, $description]) {
            $id = DB::table('permissions')->where('name', $name)->value('id');

            if (!$id) {
                $id = DB::table('permissions')->insertGetId([
                    'name' => $name,
                    'guard_name' => 'web',
                    'display_name' => $display,
                    'category' => 'Laboratory',
                    'description' => $description,
                    'status' => 'active',
                    'is_system' => 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }

            if (!$sourceId || !Schema::hasTable('role_has_permissions')) {
                continue;
            }

            $already = DB::table('role_has_permissions')->where('permission_id', $id)->pluck('role_id')->all();

            $rows = DB::table('role_has_permissions')
                ->where('permission_id', $sourceId)
                ->pluck('role_id')
                ->reject(fn ($roleId) => in_array($roleId, $already))
                ->map(fn ($roleId) => ['role_id' => $roleId, 'permission_id' => $id])
                ->values()
                ->all();

            if ($rows) {
                DB::table('role_has_permissions')->insert($rows);
            }
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        $ids = DB::table('permissions')->whereIn('name', array_keys(self::PERMISSIONS))->pluck('id');

        if ($ids->isNotEmpty() && Schema::hasTable('role_has_permissions')) {
            DB::table('role_has_permissions')->whereIn('permission_id', $ids)->delete();
        }

        DB::table('permissions')->whereIn('name', array_keys(self::PERMISSIONS))->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
