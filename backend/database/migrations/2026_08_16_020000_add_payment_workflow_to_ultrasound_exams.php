<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Give an ultrasound exam a payment side.
 *
 * The table carried a fee but nothing about whether it had been collected, so
 * reception had no way to take money for an exam and the ledger had to guess:
 * it treated a completed exam as settled and everything else as owed. Modelled
 * on lab_orders, so the two counter workflows behave the same way.
 *
 * Existing rows are backfilled from that same assumption -- a completed exam is
 * marked paid -- which keeps the ledger's current view of history intact rather
 * than silently reopening old balances.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ultrasound_exams', function (Blueprint $table) {
            $table->string('payment_status', 20)->default('unpaid')->after('status');
            $table->decimal('paid_amount', 12, 2)->default(0)->after('fee');
            $table->string('payment_method', 50)->nullable()->after('paid_amount');
            $table->timestamp('paid_at')->nullable()->after('payment_method');
            $table->string('paid_by')->nullable()->after('paid_at');
            $table->string('receipt_number')->nullable()->after('paid_by');

            $table->index(['hospital_id', 'payment_status'], 'ultrasound_exams_hospital_payment_index');
        });

        // Completed exams were already reported as collected income, so they
        // are marked paid to match. Anything else starts unpaid.
        DB::table('ultrasound_exams')
            ->whereIn('status', ['completed', 'final', 'paid'])
            ->update([
                'payment_status' => 'paid',
                'paid_amount' => DB::raw('COALESCE(fee, 0)'),
                'paid_at' => DB::raw('COALESCE(examined_at, created_at)'),
            ]);
    }

    public function down(): void
    {
        Schema::table('ultrasound_exams', function (Blueprint $table) {
            $table->dropIndex('ultrasound_exams_hospital_payment_index');
            $table->dropColumn([
                'payment_status',
                'paid_amount',
                'payment_method',
                'paid_at',
                'paid_by',
                'receipt_number',
            ]);
        });
    }
};
