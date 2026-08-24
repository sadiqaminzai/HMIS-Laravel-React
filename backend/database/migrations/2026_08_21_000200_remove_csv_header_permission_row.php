<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Delete the permission that is really a CSV header row.
 *
 * A permission import once included its own header line, so a row was created
 * with name `"name"`, display_name `display_name` and category `category`. It
 * grants nothing -- no code asks for a permission by that name -- but it shows
 * up in the Roles screen as a category of its own, sitting between Cash
 * Collection and Dashboard in the tab strip and pushing the real groups out of
 * view. Several roles have it ticked, which is meaningless.
 *
 * Matched on the literal name rather than the id, and on the header shape
 * rather than "anything odd", so this can only ever remove that one row.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        $ids = DB::table('permissions')
            ->where('display_name', 'display_name')
            ->where('category', 'category')
            ->pluck('id');

        if ($ids->isEmpty()) {
            return;
        }

        foreach (['role_has_permissions', 'model_has_permissions'] as $pivot) {
            if (Schema::hasTable($pivot)) {
                DB::table($pivot)->whereIn('permission_id', $ids)->delete();
            }
        }

        DB::table('permissions')->whereIn('id', $ids)->delete();
    }

    public function down(): void
    {
        // Deliberately not restored: it was never a permission.
    }
};
