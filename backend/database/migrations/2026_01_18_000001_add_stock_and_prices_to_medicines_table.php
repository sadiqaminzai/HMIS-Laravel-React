<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            $table->unsignedInteger('stock')->default(0)->after('strength');
            $table->decimal('cost_price', 15, 2)->default(0)->after('stock');
            $table->decimal('sale_price', 15, 2)->default(0)->after('cost_price');
        });
    }

    public function down(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            $table->dropColumn(['stock', 'cost_price', 'sale_price']);
        });
    }
};
