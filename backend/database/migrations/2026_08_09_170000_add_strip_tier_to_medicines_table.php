<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Three-tier packaging: Box -> Strips -> Pieces.
 *
 *   pieces_per_strip  pieces in one strip   (Risek: 7 capsules, Neurobion: 5 ampoules)
 *   strips_per_pack   strips in one box     (Risek: 2 strips,   Neurobion: 10 strips)
 *   pack_size         TOTAL pieces per box  -- kept as the derived product of the two
 *                     above so every existing conversion (base_qtty = qty * factor)
 *                     keeps working untouched.
 *   strip_price       price of one strip; null derives from sale_price * pieces_per_strip
 *   strip_label       human label for the middle tier (Strip, Sachet, Card)
 *   sellable_units    which units the pharmacist may sell this product in, e.g.
 *                     ["strip","pack"]. A syrup stays ["piece"].
 *   default_sale_unit which unit a sale line starts on.
 *
 * Backfill maps existing 2-tier data to pieces_per_strip = pack_size and
 * strips_per_pack = 1, which preserves the total exactly. Those products keep
 * offering piece/pack only, because the strip tier is only meaningful when
 * strips_per_pack > 1.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            if (!Schema::hasColumn('medicines', 'pieces_per_strip')) {
                $table->unsignedInteger('pieces_per_strip')->default(1)->after('pack_size');
            }
            if (!Schema::hasColumn('medicines', 'strips_per_pack')) {
                $table->unsignedInteger('strips_per_pack')->default(1)->after('pieces_per_strip');
            }
            if (!Schema::hasColumn('medicines', 'strip_price')) {
                $table->decimal('strip_price', 15, 2)->nullable()->after('pack_price');
            }
            if (!Schema::hasColumn('medicines', 'strip_label')) {
                $table->string('strip_label', 50)->nullable()->after('pack_label');
            }
            if (!Schema::hasColumn('medicines', 'sellable_units')) {
                $table->json('sellable_units')->nullable()->after('strip_label');
            }
            if (!Schema::hasColumn('medicines', 'default_sale_unit')) {
                $table->string('default_sale_unit', 10)->default('piece')->after('sellable_units');
            }
        });

        // Preserve existing totals: a 2-tier "1 pack = N pieces" becomes a single
        // strip of N, so pack_size (N * 1) is unchanged.
        DB::statement('UPDATE medicines SET pieces_per_strip = GREATEST(pack_size, 1), strips_per_pack = 1 WHERE pieces_per_strip = 1');
    }

    public function down(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            foreach ([
                'default_sale_unit',
                'sellable_units',
                'strip_label',
                'strip_price',
                'strips_per_pack',
                'pieces_per_strip',
            ] as $column) {
                if (Schema::hasColumn('medicines', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
