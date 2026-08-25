<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('hospital_settings', 'pharmacy_walk_in_show_phone')) {
                $table->boolean('pharmacy_walk_in_show_phone')
                    ->default(true)
                    ->after('pharmacy_walk_in_default_address');
            }
            if (!Schema::hasColumn('hospital_settings', 'pharmacy_walk_in_show_address')) {
                $table->boolean('pharmacy_walk_in_show_address')
                    ->default(true)
                    ->after('pharmacy_walk_in_show_phone');
            }
            if (!Schema::hasColumn('hospital_settings', 'pharmacy_walk_in_name_editable')) {
                $table->boolean('pharmacy_walk_in_name_editable')
                    ->default(true)
                    ->after('pharmacy_walk_in_show_address');
            }
        });
    }

    public function down(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            foreach ([
                'pharmacy_walk_in_name_editable',
                'pharmacy_walk_in_show_address',
                'pharmacy_walk_in_show_phone',
            ] as $column) {
                if (Schema::hasColumn('hospital_settings', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
