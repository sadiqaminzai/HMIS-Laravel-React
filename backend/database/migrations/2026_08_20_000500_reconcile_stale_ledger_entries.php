<?php

use App\Models\Transaction;
use App\Services\LedgerPostingService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Bring ledger_entries back in step with the documents it mirrors.
 *
 * Two kinds of drift had accumulated, both invisible until the payment
 * collection desk started reading the ledger as a work queue rather than as a
 * report:
 *
 *  1. ORPHANS. Ledger rows whose source document no longer exists. The desk
 *     offered them for collection and the settle attempt died with "No query
 *     results for model", because there was nothing left to pay.
 *
 *  2. PHARMACY AMOUNTS. PharmacyFinanceController recorded payments on the
 *     transaction but never reposted its snapshot, so the ledger still showed
 *     settled invoices as owing. The desk offered those too, and the API
 *     answered "This document is already fully settled."
 *
 * The controller gap is fixed alongside this migration; this repairs the rows
 * that were already written. Orphans are VOIDED rather than deleted -- a ledger
 * is an audit record, and a voided row still shows that something was once
 * posted and later withdrawn.
 */
return new class extends Migration
{
    /** source_type => table holding the document. */
    private const SOURCES = [
        'appointment' => 'appointments',
        'lab_order' => 'lab_orders',
        'ultrasound_exam' => 'ultrasound_exams',
        'patient_surgery' => 'patient_surgeries',
        'room_booking' => 'room_bookings',
        'transaction' => 'transactions',
        'expense' => 'expenses',
        'other_income' => 'other_incomes',
    ];

    public function up(): void
    {
        if (!Schema::hasTable('ledger_entries')) {
            return;
        }

        $now = now();

        foreach (self::SOURCES as $sourceType => $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            DB::table('ledger_entries')
                ->where('source_type', $sourceType)
                ->whereNull('voided_at')
                ->whereNotExists(function ($query) use ($table) {
                    $query->select(DB::raw(1))
                        ->from($table)
                        ->whereColumn($table . '.id', 'ledger_entries.source_id');
                })
                ->update([
                    'voided_at' => $now,
                    'updated_at' => $now,
                ]);
        }

        // Repost every pharmacy transaction whose ledger figures disagree with
        // the document. Done through the posting service rather than by writing
        // the columns directly, so the snapshot is built exactly as a live
        // payment would build it.
        if (Schema::hasTable('transactions')) {
            $service = app(LedgerPostingService::class);

            DB::table('ledger_entries')
                ->join('transactions', 'transactions.id', '=', 'ledger_entries.source_id')
                ->where('ledger_entries.source_type', 'transaction')
                ->whereNull('ledger_entries.voided_at')
                ->whereRaw('ABS(ledger_entries.paid_amount - transactions.paid_amount) > 0.01')
                ->select('transactions.id')
                ->pluck('transactions.id')
                ->each(function ($id) use ($service) {
                    $transaction = Transaction::find($id);
                    if ($transaction) {
                        $service->upsertTransactionSnapshot($transaction);
                    }
                });
        }
    }

    public function down(): void
    {
        // Not reversible: the rows voided here describe documents that no longer
        // exist, and un-voiding them would put uncollectable charges back in
        // front of the counter.
    }
};
