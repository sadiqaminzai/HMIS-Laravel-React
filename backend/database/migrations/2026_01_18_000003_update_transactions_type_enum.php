<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('transactions')) {
            DB::statement("ALTER TABLE transactions MODIFY trx_type ENUM('purchase','sales','purchase_return','sales_return') NOT NULL");
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('transactions')) {
            DB::statement("ALTER TABLE transactions MODIFY trx_type ENUM('purchase','sales') NOT NULL");
        }
    }
};
