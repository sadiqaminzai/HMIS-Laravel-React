<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Let a desk hand out the receipt before the money is taken.
 *
 * The reprint button was hidden entirely while a lab order was unpaid, on the
 * assumption that a receipt only exists once payment has been made. With entry
 * and collection split across two people that no longer holds: the clerk raises
 * the order and the patient carries the paper to the cashier, so the slip has to
 * be printable while it is still unpaid.
 *
 * It stays a permission rather than becoming the default, because a receipt
 * printed before payment can be mistaken for proof of payment. Whoever grants
 * it is choosing to accept that.
 */
return new class extends Migration
{
    private const NAME = 'print_unpaid_lab_receipt';

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
            'display_name' => 'Print Receipt For An Unpaid Lab Order',
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
