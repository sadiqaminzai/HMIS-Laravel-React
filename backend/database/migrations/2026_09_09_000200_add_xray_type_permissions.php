<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Rights over the X-Ray study catalogue.
 *
 * Same five verbs the ultrasound types already carry, under the Radiology
 * category the rest of the X-Ray permissions use. Nobody is granted these
 * here: they are handed out through the permissions CSV like every other
 * right, and super_admin bypasses the check regardless.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        'view_xray_types' => ['View X-Ray Types', 'See the X-Ray study catalogue'],
        'add_xray_types' => ['Add X-Ray Types', 'Create a new X-Ray study'],
        'edit_xray_types' => ['Edit X-Ray Types', 'Change an existing X-Ray study'],
        'delete_xray_types' => ['Delete X-Ray Types', 'Remove an X-Ray study from the catalogue'],
        'manage_xray_types' => ['Manage X-Ray Types', 'Full control of the X-Ray study catalogue'],
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
                'category' => 'Radiology',
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
