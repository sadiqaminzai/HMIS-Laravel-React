<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A permission for deleting an ultrasound receipt.
 *
 * The Ultrasound Receipt panel offered Add and Print only, so removing a
 * receipt raised at the wrong counter meant granting Manage Ultrasound Exams
 * -- which also lets the holder edit every exam and its result. This is the
 * narrow right on its own.
 */
return new class extends Migration
{
    private const NAME = 'delete_ultrasound_receipt';

    public function up(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }
        if (DB::table('permissions')->where('name', self::NAME)->exists()) {
            return;
        }

        $row = [
            'name' => self::NAME,
            'display_name' => 'Delete Ultrasound Receipt',
            'category' => 'Ultrasound',
            'created_at' => now(),
            'updated_at' => now(),
        ];
        if (Schema::hasColumn('permissions', 'guard_name')) $row['guard_name'] = 'web';
        if (Schema::hasColumn('permissions', 'status')) $row['status'] = 'active';
        if (Schema::hasColumn('permissions', 'is_system')) $row['is_system'] = 1;

        DB::table('permissions')->insert($row);
    }

    public function down(): void
    {
        if (Schema::hasTable('permissions')) {
            DB::table('permissions')->where('name', self::NAME)->delete();
        }
    }
};
