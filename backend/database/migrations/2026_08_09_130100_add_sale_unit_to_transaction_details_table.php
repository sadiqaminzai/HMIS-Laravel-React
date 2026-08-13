<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Records the unit a line was sold in, alongside the base (piece) quantity that
 * actually moved through inventory.
 *
 *   qtty               quantity in the chosen sale unit  (e.g. 2 packs)
 *   sale_unit          'piece' | 'pack'
 *   pack_size_snapshot pieces per pack AT THE TIME OF SALE -- snapshotted so that
 *                      later edits to the medicine's pack size never rewrite
 *                      history or corrupt past invoices
 *   base_qtty          qtty * pack_size_snapshot, i.e. pieces deducted
 *   base_bonus         same conversion for bonus units
 *
 * Existing rows are backfilled as piece sales with a pack size of 1, which is
 * exactly what they were, so historical invoices and stock remain consistent.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transaction_details', function (Blueprint $table) {
            if (!Schema::hasColumn('transaction_details', 'sale_unit')) {
                $table->string('sale_unit', 10)->default('piece')->after('qtty');
            }
            if (!Schema::hasColumn('transaction_details', 'pack_size_snapshot')) {
                $table->unsignedInteger('pack_size_snapshot')->default(1)->after('sale_unit');
            }
            if (!Schema::hasColumn('transaction_details', 'base_qtty')) {
                $table->unsignedInteger('base_qtty')->default(0)->after('pack_size_snapshot');
            }
            if (!Schema::hasColumn('transaction_details', 'base_bonus')) {
                $table->unsignedInteger('base_bonus')->default(0)->after('base_qtty');
            }
        });

        // Backfill history: every existing line was a piece sale.
        DB::statement('UPDATE transaction_details SET base_qtty = qtty WHERE base_qtty = 0');
        DB::statement('UPDATE transaction_details SET base_bonus = bonus WHERE base_bonus = 0');
    }

    public function down(): void
    {
        Schema::table('transaction_details', function (Blueprint $table) {
            foreach (['base_bonus', 'base_qtty', 'pack_size_snapshot', 'sale_unit'] as $column) {
                if (Schema::hasColumn('transaction_details', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
