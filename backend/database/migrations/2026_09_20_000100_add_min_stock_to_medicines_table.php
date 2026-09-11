<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Reorder level, per medicine, expressed in PACKS.
 *
 * Stock everywhere else in the system is counted in pieces (medicines.stock,
 * stocks.stock_qty, stock_movements), but nobody reorders in pieces -- a
 * pharmacist asks the supplier for five boxes, not for a hundred tablets. So
 * the threshold is entered and displayed in packs and converted to pieces at
 * comparison time using the medicine's own pack_size:
 *
 *     is_low  <=>  medicines.stock <= min_stock * GREATEST(pack_size, 1)
 *
 * NULL means "no threshold set for this product", which falls back to the
 * hospital-wide default rather than being treated as zero -- zero would mark
 * every unconfigured medicine as permanently healthy and hide the whole point
 * of the report until someone had filled in 934 rows by hand.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            if (!Schema::hasColumn('medicines', 'min_stock')) {
                $table->unsignedInteger('min_stock')->nullable()->after('stock');
            }
        });
    }

    public function down(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            if (Schema::hasColumn('medicines', 'min_stock')) {
                $table->dropColumn('min_stock');
            }
        });
    }
};
