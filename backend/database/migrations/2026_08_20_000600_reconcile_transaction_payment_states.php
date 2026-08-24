<?php

use App\Models\Transaction;
use App\Services\LedgerPostingService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Make payment_status agree with the amounts on every transaction.
 *
 * store() derived the status from the amounts; update() did not. So editing an
 * invoice and typing the full sum into Paid wrote paid_amount and due_amount but
 * left the status at 'pending'. The finance list then showed a document badged
 * PENDING with its money already sitting under Paid and nothing under Due -- and
 * the outstanding figure at the top, which sums due_amount, correctly left it
 * out. Two readings of the same invoice, neither obviously wrong on screen.
 *
 * The amounts are treated as the truth and the status is recomputed from them,
 * because money received is a fact while the badge is a label derived from it.
 * Nothing here changes what anyone was paid.
 *
 * The ledger snapshot is reposted for every row corrected, so the collection
 * desk and the day-end handover see the same state as the finance list.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('transactions')) {
            return;
        }

        $service = app(LedgerPostingService::class);

        DB::table('transactions')
            ->select('id')
            // Rows whose badge does not follow from their own figures.
            ->whereRaw("(
                (ROUND(paid_amount, 2) <= 0 AND ROUND(grand_total, 2) > 0 AND payment_status <> 'pending')
                OR (ROUND(grand_total - paid_amount, 2) > 0 AND ROUND(paid_amount, 2) > 0 AND payment_status <> 'partial')
                OR (ROUND(grand_total - paid_amount, 2) <= 0 AND ROUND(paid_amount, 2) > 0 AND payment_status <> 'paid')
            )")
            ->orderBy('id')
            ->pluck('id')
            ->each(function ($id) use ($service) {
                $transaction = Transaction::find($id);
                if (!$transaction) {
                    return;
                }

                $transaction->syncPaymentState();

                // A document that turns out to be settled still needs a
                // settlement date, or it drops out of the day-end totals.
                if ((string) $transaction->payment_status === 'paid') {
                    $transaction->last_payment_at = $transaction->last_payment_at ?? $transaction->updated_at ?? now();
                }

                $transaction->saveQuietly();
                $service->upsertTransactionSnapshot($transaction);
            });
    }

    public function down(): void
    {
        // Not reversible: the previous statuses were the inconsistent ones, and
        // restoring them would put the contradiction back.
    }
};
