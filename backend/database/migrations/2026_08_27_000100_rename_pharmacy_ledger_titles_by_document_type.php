<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Give historic pharmacy ledger rows the same specific reference new ones get.
 *
 * Every pharmacy document was titled "Transaction #789" regardless of what it
 * was, so a collector reading the Payment Collection queue could not tell a
 * sales invoice from a purchase or a return -- four different pieces of paper,
 * two of them money going the other way. Going forward the title is written
 * from the document type (see LedgerPostingService::TRANSACTION_TITLES); this
 * brings existing rows up to the same naming so the desk is not reading two
 * conventions in one list.
 *
 * The serial is kept exactly as it was: only the words in front of the "#"
 * change, so nothing that matches on the number is affected.
 */
return new class extends Migration
{
    private const TITLES = [
        'sales' => 'Sales Invoice',
        'purchase' => 'Purchase Invoice',
        'sales_return' => 'Return In',
        'purchase_return' => 'Return Out',
    ];

    public function up(): void
    {
        if (!Schema::hasTable('ledger_entries')) {
            return;
        }

        foreach (self::TITLES as $category => $label) {
            DB::table('ledger_entries')
                ->where('module', 'pharmacy')
                ->where('category', $category)
                ->where('title', 'like', 'Transaction #%')
                ->update([
                    'title' => DB::raw(
                        "CONCAT('" . $label . " #', SUBSTRING(title, " . (strlen('Transaction #') + 1) . "))"
                    ),
                ]);
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('ledger_entries')) {
            return;
        }

        foreach (self::TITLES as $category => $label) {
            DB::table('ledger_entries')
                ->where('module', 'pharmacy')
                ->where('category', $category)
                ->where('title', 'like', $label . ' #%')
                ->update([
                    'title' => DB::raw(
                        "CONCAT('Transaction #', SUBSTRING(title, " . (strlen($label . ' #') + 1) . "))"
                    ),
                ]);
        }
    }
};
