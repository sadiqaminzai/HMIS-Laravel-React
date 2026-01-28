<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('hospital_settings', 'show_out_of_stock_medicines_to_pharmacy')) {
                $table->boolean('show_out_of_stock_medicines_to_pharmacy')
                    ->default(false)
                    ->after('show_out_of_stock_medicines_to_doctors');
            }
        });
    }

    public function down(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            if (Schema::hasColumn('hospital_settings', 'show_out_of_stock_medicines_to_pharmacy')) {
                $table->dropColumn('show_out_of_stock_medicines_to_pharmacy');
            }
        });
    }
};
