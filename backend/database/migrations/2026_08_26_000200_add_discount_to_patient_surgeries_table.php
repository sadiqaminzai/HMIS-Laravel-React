<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Give a patient surgery the same discount structure an appointment has.
 *
 * Hospitals announce campaign discounts on operations ("30% off caesareans"),
 * and until now the only way to record one was to overwrite `cost` -- which
 * destroyed the list price, so nobody could tell a discounted operation from a
 * cheap one, and the ledger had no discount to report.
 *
 * `cost` therefore keeps its existing meaning, the gross price, and the money
 * actually owed moves to `net_amount`. Existing rows are backfilled with no
 * discount, so their net equals the cost they already had.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patient_surgeries', function (Blueprint $table) {
            // Full waiver, matching appointments' `discount_enabled`.
            $table->boolean('discount_enabled')->default(false)->after('cost');
            // Kept alongside the amount so the card can print "30%" rather than
            // making the reader divide two numbers to recover the campaign.
            $table->decimal('discount_percentage', 5, 2)->default(0)->after('discount_enabled');
            $table->decimal('discount_amount', 12, 2)->default(0)->after('discount_percentage');
            $table->decimal('net_amount', 12, 2)->default(0)->after('discount_amount');
        });

        DB::table('patient_surgeries')->update([
            'net_amount' => DB::raw('COALESCE(cost, 0)'),
        ]);
    }

    public function down(): void
    {
        Schema::table('patient_surgeries', function (Blueprint $table) {
            $table->dropColumn(['discount_enabled', 'discount_percentage', 'discount_amount', 'net_amount']);
        });
    }
};
