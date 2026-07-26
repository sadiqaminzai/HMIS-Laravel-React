<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('hospital_settings', 'show_prescription_list_meta')) {
                $table->boolean('show_prescription_list_meta')
                    ->default(true)
                    ->after('show_out_of_stock_medicines_to_pharmacy');
            }
        });
    }

    public function down(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            if (Schema::hasColumn('hospital_settings', 'show_prescription_list_meta')) {
                $table->dropColumn('show_prescription_list_meta');
            }
        });
    }
};
