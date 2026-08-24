<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Separate "who collected the money" from "who last saved the document".
 *
 * The handover report groups by posted_by, which LedgerPostingService fills
 * from updated_by ?? created_by. That makes cash attribution follow the last
 * editor: a clerk who corrects a lab order after the cashier settled it takes
 * the money with them into their own handover, and neither person's paper then
 * matches their drawer.
 *
 * collected_by / collected_at are written only when a payment is actually
 * taken, so they cannot drift with later edits. posted_by stays exactly as it
 * is -- it is still the right answer to "who entered this" and is used
 * elsewhere -- and the report simply groups by the new column instead.
 *
 * Backfilled from posted_by wherever money was received, so historical handover
 * totals are unchanged by this migration.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('ledger_entries')) {
            return;
        }

        Schema::table('ledger_entries', function (Blueprint $table) {
            if (!Schema::hasColumn('ledger_entries', 'collected_by')) {
                $table->string('collected_by', 191)->nullable()->after('posted_by');
            }
            if (!Schema::hasColumn('ledger_entries', 'collected_at')) {
                $table->timestamp('collected_at')->nullable()->after('collected_by');
            }
        });

        if (!$this->indexExists('ledger_entries', 'ledger_hospital_collected_at_idx')) {
            Schema::table('ledger_entries', function (Blueprint $table) {
                $table->index(['hospital_id', 'collected_at'], 'ledger_hospital_collected_at_idx');
            });
        }

        // Only rows that actually received money: a pending charge has no
        // collector, and inventing one would put unearned cash in a handover.
        DB::table('ledger_entries')
            ->whereNull('collected_by')
            ->where('paid_amount', '>', 0)
            ->update([
                'collected_by' => DB::raw('posted_by'),
                'collected_at' => DB::raw('posted_at'),
            ]);
    }

    public function down(): void
    {
        if (!Schema::hasTable('ledger_entries')) {
            return;
        }

        if ($this->indexExists('ledger_entries', 'ledger_hospital_collected_at_idx')) {
            Schema::table('ledger_entries', function (Blueprint $table) {
                $table->dropIndex('ledger_hospital_collected_at_idx');
            });
        }

        Schema::table('ledger_entries', function (Blueprint $table) {
            foreach (['collected_at', 'collected_by'] as $column) {
                if (Schema::hasColumn('ledger_entries', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }

    private function indexExists(string $table, string $index): bool
    {
        return collect(DB::select("SHOW INDEX FROM `{$table}`"))
            ->contains(fn ($row) => ($row->Key_name ?? null) === $index);
    }
};
