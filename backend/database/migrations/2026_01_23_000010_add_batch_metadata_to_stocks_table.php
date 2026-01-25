<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('stocks', function (Blueprint $table) {
            $table->date('expiry_date')->nullable()->after('batch_no');
            $table->unsignedInteger('bonus_qty')->default(0)->after('stock_qty');
            $table->decimal('purchase_price', 15, 2)->default(0)->after('bonus_qty');
            $table->decimal('sale_price', 15, 2)->default(0)->after('purchase_price');
        });
    }

    public function down(): void
    {
        Schema::table('stocks', function (Blueprint $table) {
            $table->dropColumn(['expiry_date', 'bonus_qty', 'purchase_price', 'sale_price']);
        });
    }
};
