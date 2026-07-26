<?php

namespace App\Console\Commands;

use App\Models\LedgerEntry;
use App\Models\PayrollBatch;
use App\Models\PayrollItem;
use App\Services\LedgerPostingService;
use Illuminate\Console\Command;

class BackfillPayrollSalaryLedger extends Command
{
    protected $signature = 'ledger:backfill-payroll-salary
        {--hospital_id= : Limit to a specific hospital id}
        {--batch_id= : Limit to a specific payroll batch id}
        {--chunk=200 : Batch count per chunk}
        {--dry-run : Show what will be backfilled without writing to ledger}';

    protected $description = 'Backfill missing salary ledger snapshots for already posted payroll items.';

    public function handle(LedgerPostingService $ledgerPostingService): int
    {
        $hospitalId = $this->option('hospital_id') ? (int) $this->option('hospital_id') : null;
        $batchId = $this->option('batch_id') ? (int) $this->option('batch_id') : null;
        $chunkSize = max(1, (int) $this->option('chunk'));
        $dryRun = (bool) $this->option('dry-run');

        $batchQuery = PayrollBatch::query()
            ->where('status', 'posted')
            ->orderBy('id');

        if ($hospitalId) {
            $batchQuery->where('hospital_id', $hospitalId);
        }

        if ($batchId) {
            $batchQuery->whereKey($batchId);
        }

        $batchCount = (clone $batchQuery)->count();

        if ($batchCount === 0) {
            $this->warn('No posted payroll batches found for the given filters.');
            return self::SUCCESS;
        }

        $this->info(sprintf(
            'Scanning %d posted payroll batch(es)%s...',
            $batchCount,
            $dryRun ? ' (dry-run)' : ''
        ));

        $processedBatches = 0;
        $processedItems = 0;
        $missingItems = 0;
        $backfilledItems = 0;
        $skippedExisting = 0;
        $failedItems = 0;

        $batchQuery->chunkById($chunkSize, function ($batches) use (
            $dryRun,
            $ledgerPostingService,
            &$processedBatches,
            &$processedItems,
            &$missingItems,
            &$backfilledItems,
            &$skippedExisting,
            &$failedItems
        ) {
            foreach ($batches as $batch) {
                $processedBatches++;

                $items = PayrollItem::query()
                    ->with('employee:id,first_name,last_name')
                    ->where('payroll_batch_id', $batch->id)
                    ->where('status', 'paid')
                    ->orderBy('id')
                    ->get();

                if ($items->isEmpty()) {
                    continue;
                }

                $processedItems += $items->count();

                $existingSourceIds = LedgerEntry::query()
                    ->where('hospital_id', (int) $batch->hospital_id)
                    ->where('source_type', 'payroll_item')
                    ->where('event_type', 'snapshot')
                    ->where('revision', 1)
                    ->whereIn('source_id', $items->pluck('id')->all())
                    ->pluck('source_id')
                    ->map(fn ($id) => (int) $id)
                    ->flip();

                foreach ($items as $item) {
                    $itemId = (int) $item->id;

                    if ($existingSourceIds->has($itemId)) {
                        $skippedExisting++;
                        continue;
                    }

                    $missingItems++;

                    if ($dryRun) {
                        continue;
                    }

                    try {
                        $ledgerPostingService->upsertPayrollItemSnapshot($batch, $item);
                        $backfilledItems++;
                    } catch (\Throwable $e) {
                        $failedItems++;
                        $this->error(sprintf(
                            'Failed payroll_item #%d (batch #%d): %s',
                            $itemId,
                            (int) $batch->id,
                            $e->getMessage()
                        ));
                    }
                }
            }
        });

        $this->newLine();
        $this->line('Backfill summary:');
        $this->table(
            ['Metric', 'Value'],
            [
                ['Posted payroll batches scanned', (string) $processedBatches],
                ['Paid payroll items scanned', (string) $processedItems],
                ['Items already in ledger (skipped)', (string) $skippedExisting],
                ['Items missing salary ledger snapshot', (string) $missingItems],
                ['Items backfilled', $dryRun ? '0 (dry-run)' : (string) $backfilledItems],
                ['Items failed', (string) $failedItems],
            ]
        );

        if ($failedItems > 0) {
            return self::FAILURE;
        }

        if ($dryRun) {
            $this->info('Dry-run complete. Re-run without --dry-run to apply changes.');
        } else {
            $this->info('Backfill complete.');
        }

        return self::SUCCESS;
    }
}
