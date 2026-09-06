<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Who may set a hospital's standing discount.
 *
 * Separate from the per-receipt discount rights (add_discounts and friends):
 * a receptionist may well be trusted to discount one bill without being
 * trusted to change what every bill charges from now on.
 */
return new class extends Migration
{
    private const PERMISSION = 'manage_default_discounts';

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
            'display_name' => 'Manage Default Discounts',
            'category' => 'Settings',
            'created_at' => now(),
            'updated_at' => now(),
        ];

        if (Schema::hasColumn('permissions', 'guard_name')) $row['guard_name'] = 'web';
        if (Schema::hasColumn('permissions', 'status')) $row['status'] = 'active';
        if (Schema::hasColumn('permissions', 'is_system')) $row['is_system'] = 1;
        if (Schema::hasColumn('permissions', 'description')) {
            $row['description'] = 'Set the standing discount applied to new surgery, lab, ultrasound, X-Ray and dental receipts';
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
