<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Bring payment_status back in line with the amounts already recorded.
 *
 * TransactionController::store never called syncPaymentState, so an invoice
 * created with the full amount paid was stored as 'pending'. The finance list
 * then showed money received against an outstanding document, and any report
 * keyed off status disagreed with the same report keyed off paid_amount.
 *
 * Only rows whose status contradicts their own amounts are touched; nothing is
 * inferred beyond what the numbers already say.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Fully settled but not marked paid.
        DB::table('transactions')
            ->whereColumn('paid_amount', '>=', 'grand_total')
            ->where('grand_total', '>', 0)
            ->where('payment_status', '!=', 'paid')
            ->update([
                'payment_status' => 'paid',
                'due_amount' => 0,
                'last_payment_at' => DB::raw('COALESCE(last_payment_at, updated_at)'),
            ]);

        // Part paid but recorded as pending.
        DB::table('transactions')
            ->where('paid_amount', '>', 0)
            ->whereColumn('paid_amount', '<', 'grand_total')
            ->where('payment_status', 'pending')
            ->update(['payment_status' => 'partial']);
    }

    public function down(): void
    {
        // Not reversible: the previous values contradicted the amounts they
        // were stored alongside.
    }
};
