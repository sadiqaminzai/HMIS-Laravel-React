<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            $table->boolean('show_out_of_stock_medicines_to_doctors')
                ->default(false)
                ->after('print_show_bonus_column');
        });
    }

    public function down(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            $table->dropColumn('show_out_of_stock_medicines_to_doctors');
        });
    }
};
