<?php

namespace App\Console\Commands;

use App\Models\UltrasoundExam;
use App\Services\LedgerPostingService;
use Illuminate\Console\Command;

/**
 * Post ledger entries for ultrasound exams recorded before radiology income was
 * wired into the ledger.
 *
 * Until now no ultrasound fee was ever posted, so this income was missing from
 * every financial report and from the dashboard's Revenue. New exams post
 * themselves; existing rows need this one-off pass.
 *
 * Safe to re-run: the ledger upserts by (source_type, source_id), so an exam
 * already posted is updated in place rather than duplicated.
 *
 * Dry run by default. Pass --apply to write.
 */
class BackfillUltrasoundLedger extends Command
{
    protected $signature = 'ledger:backfill-ultrasound
                            {--hospital= : Limit to one hospital id}
                            {--apply : Write the entries (otherwise dry run)}';

    protected $description = 'Post missing ledger entries for existing ultrasound exams';

    public function handle(LedgerPostingService $ledger): int
    {
        $hospitalId = $this->option('hospital') ? (int) $this->option('hospital') : null;
        $apply = (bool) $this->option('apply');

        $exams = UltrasoundExam::query()
            ->when($hospitalId, fn ($q) => $q->where('hospital_id', $hospitalId))
            ->orderBy('id')
            ->get();

        $total = (float) $exams->sum('fee');

        $this->line(sprintf('Exams found : %d', $exams->count()));
        $this->line(sprintf('Total fees  : %s', number_format($total, 2)));

        if (!$apply) {
            $this->warn('Dry run. Re-run with --apply to post these entries.');
            return self::SUCCESS;
        }

        $posted = 0;
        foreach ($exams as $exam) {
            $ledger->upsertUltrasoundExamSnapshot($exam);
            $posted++;
        }

        $this->info(sprintf('Posted %d ultrasound ledger entries.', $posted));

        return self::SUCCESS;
    }
}
