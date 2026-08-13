<?php

namespace App\Console\Commands;

use App\Models\Medicine;
use App\Models\Stock;
use App\Models\StockMovement;
use App\Models\TransactionDetail;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Rebuild stock levels from the documents that created them.
 *
 * Needed because editing a purchase used to reverse the PACK count while the
 * original had been applied in PIECES, so every edit of a packaged line left
 * phantom pieces behind (a 10-pack line of 60 added 600 but removed only 10).
 * The controller no longer does this, but stock already written to the database
 * stays wrong until it is recomputed.
 *
 * Source of truth, per medicine and batch:
 *   + purchases and sales returns   (base_qtty + base_bonus)
 *   - sales and purchase returns    (base_qtty + base_bonus)
 *   +/- non-transaction movements   (dispensing, manual adjustments)
 *
 * The stock_movements ledger is NOT used for transaction lines: it recorded the
 * same faulty reversals, so replaying it would reproduce the error.
 *
 * Dry run by default. Pass --apply to write.
 */
class RecalculateStock extends Command
{
    protected $signature = 'stock:recalculate
                            {--hospital= : Limit to one hospital id}
                            {--apply : Write the corrected values (otherwise dry run)}';

    protected $description = 'Rebuild stocks and medicines.stock from transaction details';

    public function handle(): int
    {
        $hospitalId = $this->option('hospital') ? (int) $this->option('hospital') : null;
        $apply = (bool) $this->option('apply');

        // ---- expected quantity per (hospital, medicine, batch) --------------
        $rows = TransactionDetail::query()
            ->join('transactions', 'transactions.id', '=', 'transaction_details.trx_id')
            ->when($hospitalId, fn ($q) => $q->where('transactions.hospital_id', $hospitalId))
            ->selectRaw('transactions.hospital_id, transaction_details.medicine_id, transaction_details.batch_no')
            // CAST to SIGNED: the base columns are UNSIGNED, so multiplying by
            // -1 for outgoing types overflows instead of going negative.
            ->selectRaw("SUM(CASE WHEN transactions.trx_type IN ('purchase','sales_return') THEN 1 ELSE -1 END"
                . ' * (CAST(transaction_details.base_qtty AS SIGNED)'
                . ' + CAST(transaction_details.base_bonus AS SIGNED))) as qty')
            ->groupBy('transactions.hospital_id', 'transaction_details.medicine_id', 'transaction_details.batch_no')
            ->get();

        $expected = [];
        foreach ($rows as $row) {
            $expected[$this->key($row->hospital_id, $row->medicine_id, $row->batch_no)] = (int) $row->qty;
        }

        // ---- movements that did not come from a transaction -----------------
        // Dispensing and reconciliation adjustments are only recorded here.
        $extra = StockMovement::query()
            ->whereNull('trx_id')
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->selectRaw('hospital_id, medicine_id, batch_no, SUM(qty_change + COALESCE(bonus_change, 0)) as qty')
            ->groupBy('hospital_id', 'medicine_id', 'batch_no')
            ->get();

        foreach ($extra as $row) {
            $key = $this->key($row->hospital_id, $row->medicine_id, $row->batch_no);
            $expected[$key] = ($expected[$key] ?? 0) + (int) $row->qty;
        }

        // ---- compare against what is stored ---------------------------------
        $stocks = Stock::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->get();

        $changes = [];
        foreach ($stocks as $stock) {
            $key = $this->key($stock->hospital_id, $stock->medicine_id, $stock->batch_no);
            $want = $expected[$key] ?? 0;
            $have = (int) $stock->stock_qty + (int) ($stock->bonus_qty ?? 0);
            if ($want !== $have) {
                $changes[] = compact('stock', 'want', 'have');
            }
            unset($expected[$key]);
        }

        $this->line(sprintf('Batches checked : %d', $stocks->count()));
        $this->line(sprintf('Batches wrong   : %d', count($changes)));
        $this->line(sprintf('Missing batches : %d', count($expected)));

        foreach (array_slice($changes, 0, 20) as $c) {
            $this->line(sprintf(
                '   medicine %-5s batch %-12s stored %-8d should be %-8d (%+d)',
                $c['stock']->medicine_id,
                (string) $c['stock']->batch_no,
                $c['have'],
                $c['want'],
                $c['want'] - $c['have']
            ));
        }
        if (count($changes) > 20) {
            $this->line(sprintf('   ... and %d more', count($changes) - 20));
        }

        if (!$apply) {
            $this->warn('Dry run. Re-run with --apply to write these corrections.');
            return self::SUCCESS;
        }

        DB::transaction(function () use ($changes, $hospitalId) {
            foreach ($changes as $c) {
                // Everything is folded into stock_qty: the split between stock
                // and bonus is presentational and cannot be reconstructed here.
                $c['stock']->stock_qty = max(0, $c['want']);
                $c['stock']->bonus_qty = 0;
                $c['stock']->save();
            }

            // medicines.stock is the denormalised sum of its batches.
            Medicine::query()
                ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
                ->each(function (Medicine $medicine) {
                    $medicine->stock = (int) Stock::query()
                        ->where('hospital_id', $medicine->hospital_id)
                        ->where('medicine_id', $medicine->id)
                        ->sum(DB::raw('stock_qty + COALESCE(bonus_qty, 0)'));
                    $medicine->save();
                });
        });

        $this->info('Stock levels rebuilt.');

        return self::SUCCESS;
    }

    private function key($hospitalId, $medicineId, $batchNo): string
    {
        return $hospitalId . '|' . $medicineId . '|' . ($batchNo ?? '');
    }
}
