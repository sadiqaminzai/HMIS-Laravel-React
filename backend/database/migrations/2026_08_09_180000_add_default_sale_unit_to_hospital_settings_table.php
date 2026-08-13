<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hospital-wide preferred selling unit.
 *
 * A retail pharmacy that sells by the box should not have to switch "Sell by" on
 * every product. This is the unit a NEW medicine adopts once its packaging makes
 * that tier available; it is not a hard rule, because a product configured 1x1
 * genuinely has no pack or strip to sell.
 *
 * Defaults to 'pack' so packaged products start on Box, matching how pharmacists
 * actually sell. Existing medicines keep whatever they already have.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('hospital_settings', 'pharmacy_default_sale_unit')) {
                $table->string('pharmacy_default_sale_unit', 10)
                    ->default('pack')
                    ->after('pharmacy_default_barcode_type');
            }
        });
    }

    public function down(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            if (Schema::hasColumn('hospital_settings', 'pharmacy_default_sale_unit')) {
                $table->dropColumn('pharmacy_default_sale_unit');
            }
        });
    }
};
