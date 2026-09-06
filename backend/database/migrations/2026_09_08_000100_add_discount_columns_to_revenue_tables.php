<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Bring lab orders, ultrasound exams and room bookings up to the discount
 * shape that surgery and X-Ray already use.
 *
 * Those two carry discount_enabled / discount_percentage / discount_amount /
 * net_amount, which is what lets a receipt show gross, discount and net and
 * lets the ledger post a truthful net figure. The other three were missing
 * most of it: lab and room bookings had a bare discount_amount with no record
 * of the percentage it came from, and ultrasound had nothing at all.
 *
 * Backfills net_amount from what each table already knows, so existing rows
 * report the same totals after this runs as before it.
 */
return new class extends Migration
{
    /**
     * table => [column net_amount is seeded from, pre-existing discount column,
     *           whether that column is already net of the discount]
     *
     * The third flag matters. lab_orders.total_amount and room_bookings
     * .total_cost look like gross columns but are not: LabOrderController
     * stores the discounted figure in total_amount, and RoomBookingService
     * returns total_cost as base_cost minus the discount. Subtracting the
     * discount from them again would take it off twice. ultrasound_exams.fee
     * really is gross, and its discount column is created here, so it is zero
     * on every existing row.
     */
    private const TABLES = [
        'lab_orders' => ['total_amount', 'discount_amount', true],
        'ultrasound_exams' => ['fee', null, false],
        'room_bookings' => ['total_cost', 'discount_amount', true],
    ];

    public function up(): void
    {
        foreach (self::TABLES as $table => [$sourceColumn, $discountColumn, $sourceIsNet]) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            Schema::table($table, function (Blueprint $table2) use ($table, $discountColumn) {
                if (!Schema::hasColumn($table, 'discount_enabled')) {
                    $table2->boolean('discount_enabled')->default(false);
                }
                if (!Schema::hasColumn($table, 'discount_percentage')) {
                    $table2->decimal('discount_percentage', 5, 2)->default(0);
                }
                if ($discountColumn === null && !Schema::hasColumn($table, 'discount_amount')) {
                    $table2->decimal('discount_amount', 12, 2)->default(0);
                }
                if (!Schema::hasColumn($table, 'net_amount')) {
                    $table2->decimal('net_amount', 12, 2)->nullable();
                }
            });

            // Seed net_amount so existing rows report exactly the same totals
            // after this runs as before it. Left nullable above precisely so
            // this backfill is visible rather than silently defaulting every
            // historical row to zero.
            if (Schema::hasColumn($table, 'net_amount') && Schema::hasColumn($table, $sourceColumn)) {
                $expression = $sourceIsNet
                    ? 'COALESCE(' . $sourceColumn . ', 0)'
                    : 'GREATEST(COALESCE(' . $sourceColumn . ', 0) - COALESCE(discount_amount, 0), 0)';

                DB::table($table)
                    ->whereNull('net_amount')
                    ->update(['net_amount' => DB::raw($expression)]);
            }
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table => [$sourceColumn, $discountColumn, $sourceIsNet]) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            $drop = array_values(array_filter(
                ['discount_enabled', 'discount_percentage', 'net_amount', $discountColumn === null ? 'discount_amount' : null],
                fn ($column) => $column !== null && Schema::hasColumn($table, $column)
            ));

            if ($drop) {
                Schema::table($table, fn (Blueprint $t) => $t->dropColumn($drop));
            }
        }
    }
};
