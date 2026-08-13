<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Pack/piece configuration for a medicine.
 *
 * The base inventory unit stays the PIECE: stocks.stock_qty, medicines.stock and
 * stock_movements continue to hold pieces, so nothing downstream changes. A pack
 * is a data-entry and pricing convenience converted at the sale boundary.
 *
 *   pack_size   pieces contained in one pack (1 = medicine is only sold loose)
 *   pack_price  price of a full pack; null means derive it as sale_price * pack_size
 *   pack_label  human label for the pack (Box, Strip). The PIECE unit is not
 *               stored here -- it is the medicine's existing Type (Capsule,
 *               Tablet, Syrup...) from the medicine_types table.
 *
 * pack_size defaults to 1 so every existing medicine behaves exactly as before:
 * one piece == one pack, and sale_price keeps its current meaning (price per piece).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            if (!Schema::hasColumn('medicines', 'pack_size')) {
                $table->unsignedInteger('pack_size')->default(1)->after('strength');
            }
            if (!Schema::hasColumn('medicines', 'pack_price')) {
                $table->decimal('pack_price', 15, 2)->nullable()->after('sale_price');
            }
            if (!Schema::hasColumn('medicines', 'pack_label')) {
                $table->string('pack_label', 50)->nullable()->after('pack_size');
            }
        });
    }

    public function down(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            foreach (['pack_label', 'pack_price', 'pack_size'] as $column) {
                if (Schema::hasColumn('medicines', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
