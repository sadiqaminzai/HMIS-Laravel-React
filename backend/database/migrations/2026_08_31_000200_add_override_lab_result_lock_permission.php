<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * An escape hatch for a lab result that has closed.
 *
 * A result may normally be corrected only by the person who entered it, on the
 * day they entered it -- that is what makes it a record rather than a working
 * note. But a genuine error found the next morning would otherwise be
 * uncorrectable forever, which is its own clinical risk.
 *
 * So the lock stays shut by default and opens only for a right that has to be
 * granted deliberately. Nobody holds it until a hospital says so, and because
 * it is a distinct permission the audit log shows who was able to use it.
 */
return new class extends Migration
{
    private const NAME = 'override_lab_result_lock';

    public function up(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        if (DB::table('permissions')->where('name', self::NAME)->exists()) {
            return;
        }

        DB::table('permissions')->insert([
            'name' => self::NAME,
            'guard_name' => 'web',
            'display_name' => 'Correct A Closed Lab Result',
            'category' => 'Laboratory',
            'status' => 'active',
            'is_system' => 0,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        $id = DB::table('permissions')->where('name', self::NAME)->value('id');
        if (!$id) {
            return;
        }

        foreach (['role_has_permissions', 'model_has_permissions'] as $pivot) {
            if (Schema::hasTable($pivot)) {
                DB::table($pivot)->where('permission_id', $id)->delete();
            }
        }

        DB::table('permissions')->where('id', $id)->delete();
    }
};
