<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Hospital-wide fallbacks for the pharmacy reports.
 *
 *  default_min_stock_packs   Reorder level applied to any medicine whose own
 *                            min_stock is NULL. Without this the Low Stock
 *                            report stays empty until every product has been
 *                            configured by hand, which for a 900-line
 *                            formulary means it stays empty forever.
 *
 *  short_expiry_days         How far ahead the Short Expiry report looks by
 *                            default. The report still takes a ?days= override
 *                            per run; this is only what the tab opens on.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('hospital_settings', 'default_min_stock_packs')) {
                $table->unsignedInteger('default_min_stock_packs')->default(5);
            }
            if (!Schema::hasColumn('hospital_settings', 'short_expiry_days')) {
                $table->unsignedInteger('short_expiry_days')->default(90);
            }
        });
    }

    public function down(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            foreach (['default_min_stock_packs', 'short_expiry_days'] as $column) {
                if (Schema::hasColumn('hospital_settings', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
