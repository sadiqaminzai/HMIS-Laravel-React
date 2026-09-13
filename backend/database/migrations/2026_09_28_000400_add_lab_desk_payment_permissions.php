<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\PermissionRegistrar;

/**
 * Take Payment and Return Payment on the Laboratory desk.
 *
 * The paid/unpaid toggle on Lab Orders was shown to anyone holding the Accounts
 * right "Collect -- Laboratory", and the endpoint behind it also let through
 * anyone who could manage lab orders -- every lab technician. It now works like
 * the Ultrasound, X-Ray and ECG desks: the desk's own Take / Return Payment
 * rights, with Accounts > Payment Collection keeping its own rights to the same
 * endpoint.
 *
 * Backfilled ONLY from the Accounts rights: a role that could already collect
 * for the laboratory through Payment Collection keeps the toggle, and a role
 * that could only because it managed lab orders loses it.
 *
 * Ends by clearing Spatie's permission cache. Rows written straight into these
 * tables are otherwise invisible to Spatie for up to 24 hours -- which is how
 * the radiology Take / Return Payment rights showed as ticked yet came back
 * Forbidden after the last deploy.
 *
 * Permission rows and role grants only. No lab order or payment is touched.
 */
return new class extends Migration
{
    /** name => [display, description, the Accounts right whose holders keep it] */
    private const PERMISSIONS = [
        'take_lab_payment' => ['Take Lab Payment', 'Mark a lab order paid from the Laboratory desk itself', 'manage_lab_payments'],
        'return_lab_payment' => ['Return Lab Payment', 'Put a paid lab order back to unpaid from the Laboratory desk itself', 'reverse_lab_payment'],
    ];

    public function up(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        foreach (self::PERMISSIONS as $name => [$display, $description, $source]) {
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

            if (!Schema::hasTable('role_has_permissions')) {
                continue;
            }

            $sourceId = DB::table('permissions')->where('name', $source)->value('id');
            if (!$sourceId) {
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
