<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();

        DB::table('permissions')->updateOrInsert(
            ['name' => 'lab_test_order_discount', 'guard_name' => 'web'],
            [
                'display_name' => 'Lab Test Order Discount',
                'category' => 'Laboratory',
                'description' => null,
                'status' => 'active',
                'is_system' => true,
                'updated_at' => $now,
                'created_at' => $now,
            ]
        );
    }

    public function down(): void
    {
        DB::table('permissions')
            ->where('name', 'lab_test_order_discount')
            ->where('guard_name', 'web')
            ->delete();
    }
};
