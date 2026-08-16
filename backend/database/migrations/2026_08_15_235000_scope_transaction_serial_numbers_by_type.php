<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Serial numbers are now issued per transaction type, so Purchase #1 and
 * Sale #1 can both exist.
 *
 * Two things follow from that:
 *
 * 1. The old unique index on (hospital_id, serial_no) would reject the second
 *    of those two rows, so it is replaced by (hospital_id, trx_type, serial_no).
 *
 * 2. Each type needs its own counter, seeded from the highest number that type
 *    has already used. Historical records are deliberately NOT renumbered --
 *    those numbers are printed on documents suppliers and patients already
 *    hold, and rewriting them would break the paper trail. Existing gaps stay
 *    as they are; numbering is only clean from here on.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropUnique('transactions_hospital_id_serial_no_unique');
            $table->unique(['hospital_id', 'trx_type', 'serial_no'], 'transactions_hospital_id_trx_type_serial_no_unique');
        });

        $highest = DB::table('transactions')
            ->selectRaw('hospital_id, trx_type, MAX(CAST(serial_no AS UNSIGNED)) as highest')
            ->whereNotNull('trx_type')
            ->where('trx_type', '!=', '')
            ->groupBy('hospital_id', 'trx_type')
            ->get();

        $now = now();

        foreach ($highest as $row) {
            $module = 'transaction:' . $row->trx_type;

            DB::table('module_sequences')->updateOrInsert(
                ['hospital_id' => $row->hospital_id, 'module' => $module],
                [
                    // updateOrInsert overwrites, so guard against a rerun
                    // lowering a counter that has since moved ahead.
                    'last_number' => max(
                        (int) $row->highest,
                        (int) (DB::table('module_sequences')
                            ->where('hospital_id', $row->hospital_id)
                            ->where('module', $module)
                            ->value('last_number') ?? 0)
                    ),
                    'updated_at' => $now,
                    'created_at' => $now,
                ]
            );
        }

        // The shared 'transaction' counter is left in place: it is harmless,
        // and keeping it means a rollback has something to fall back on.
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropUnique('transactions_hospital_id_trx_type_serial_no_unique');
            $table->unique(['hospital_id', 'serial_no'], 'transactions_hospital_id_serial_no_unique');
        });

        DB::table('module_sequences')->where('module', 'like', 'transaction:%')->delete();
    }
};
