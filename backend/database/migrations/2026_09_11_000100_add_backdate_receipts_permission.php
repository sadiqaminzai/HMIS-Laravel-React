<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Who may change the date on a receipt.
 *
 * Raising a charge and dating it are different acts. A clerk works today's
 * counter; moving a charge to another day shifts which shift, which day-end
 * sheet and which report it lands in, so it is held separately.
 *
 * One permission across the receipt desks rather than one per module, the same
 * way add_discounts governs discounting everywhere. Without it the date field
 * is locked to today; super_admin bypasses it as usual.
 */
return new class extends Migration
{
    private const PERMISSION = 'backdate_receipts';

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
            'display_name' => 'Change Receipt Date',
            'category' => 'Settings',
            'created_at' => now(),
            'updated_at' => now(),
        ];

        if (Schema::hasColumn('permissions', 'guard_name')) $row['guard_name'] = 'web';
        if (Schema::hasColumn('permissions', 'status')) $row['status'] = 'active';
        if (Schema::hasColumn('permissions', 'is_system')) $row['is_system'] = 1;
        if (Schema::hasColumn('permissions', 'description')) {
            $row['description'] = 'Set a receipt to a date other than today';
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
