<?php

namespace App\Console\Commands;

use App\Models\Doctor;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * Repairs `doctor_id` values on clinical records that still hold legacy
 * `doctors.id` numbers.
 *
 * Appointments, prescriptions and lab orders originally referenced the
 * `doctors` table. The `*_doctor_fk_to_users` migrations re-pointed the foreign
 * key at `users` but never remapped the stored values. While the recreated user
 * accounts happened to have different ids this was harmless — the reference
 * simply resolved to nothing. After user ids were recycled, those same values
 * began resolving to unrelated accounts, so a Habib-Al-Shifa prescription could
 * display a doctor belonging to a different hospital.
 *
 * This command reads each stored value as a `doctors.id`, resolves the matching
 * user in the SAME hospital, and rewrites it. Anything that cannot be resolved
 * unambiguously — or that would cross a hospital boundary — is reported and
 * left untouched.
 */
class RemapClinicalDoctorIds extends Command
{
    protected $signature = 'doctors:remap-clinical-ids {--dry-run : Report what would change without writing}';

    protected $description = 'Rewrite legacy doctors.id references on appointments, prescriptions and lab orders to the correct user id';

    /** table => the column holding the doctor reference */
    private const TARGETS = [
        'appointments' => 'doctor_id',
        'prescriptions' => 'doctor_id',
        'lab_orders' => 'doctor_id',
    ];

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');

        $rows = [];
        $planned = 0;
        $skipped = 0;

        foreach (self::TARGETS as $table => $column) {
            if (!DB::getSchemaBuilder()->hasTable($table)) {
                continue;
            }

            $records = DB::table($table)
                ->select('id', 'hospital_id', $column)
                ->whereNotNull($column)
                ->orderBy('id')
                ->get();

            foreach ($records as $record) {
                $current = (int) $record->{$column};
                $hospitalId = (int) $record->hospital_id;

                $currentUser = User::find($current);

                // Already correct: points at a user in this record's hospital.
                if ($currentUser && (int) $currentUser->hospital_id === $hospitalId) {
                    continue;
                }

                $legacyDoctor = Doctor::withTrashed()->find($current);

                if (!$legacyDoctor) {
                    $rows[] = [$table, $record->id, $current, '—', 'no legacy doctor row', 'skip'];
                    $skipped++;
                    continue;
                }

                if ((int) $legacyDoctor->hospital_id !== $hospitalId) {
                    $rows[] = [$table, $record->id, $current, '—', 'legacy doctor is in hospital '.$legacyDoctor->hospital_id, 'skip'];
                    $skipped++;
                    continue;
                }

                $target = $this->resolveUser($legacyDoctor, $hospitalId);

                if (!$target) {
                    $rows[] = [$table, $record->id, $current, '—', 'no user for "'.$legacyDoctor->name.'"', 'skip'];
                    $skipped++;
                    continue;
                }

                $rows[] = [
                    $table,
                    $record->id,
                    $current.' ('.($currentUser->name ?? 'unresolved').')',
                    $target->id.' ('.$target->name.')',
                    'hospital '.$hospitalId,
                    $dryRun ? 'would fix' : 'fixed',
                ];
                $planned++;

                if (!$dryRun) {
                    DB::table($table)->where('id', $record->id)->update([$column => $target->id]);
                }
            }
        }

        if (empty($rows)) {
            $this->info('Nothing to remap — every clinical record already points at a doctor in its own hospital.');

            return self::SUCCESS;
        }

        $this->table(['Table', 'Row', 'Current doctor_id', 'New doctor_id', 'Note', 'Action'], $rows);
        $this->newLine();
        $this->line(sprintf('%s  remapped: %d   skipped: %d', $dryRun ? '[dry run]' : '[applied]', $planned, $skipped));

        if ($dryRun) {
            $this->comment('Re-run without --dry-run to apply.');
        }

        if ($skipped > 0) {
            $this->warn('Skipped rows need manual attention — the doctor could not be resolved safely.');
        }

        return self::SUCCESS;
    }

    /**
     * Find the user account that corresponds to a legacy doctor profile,
     * constrained to the record's own hospital.
     */
    private function resolveUser(Doctor $doctor, int $hospitalId): ?User
    {
        $byLink = User::where('doctor_id', $doctor->id)->where('hospital_id', $hospitalId)->first();
        if ($byLink) {
            return $byLink;
        }

        if (!empty($doctor->email)) {
            $byEmail = User::where('email', $doctor->email)->where('hospital_id', $hospitalId)->first();
            if ($byEmail) {
                return $byEmail;
            }
        }

        $matches = User::where('role', 'doctor')
            ->where('hospital_id', $hospitalId)
            ->whereRaw('LOWER(name) = ?', [mb_strtolower(trim((string) $doctor->name))])
            ->get();

        // Only accept an unambiguous name match.
        return $matches->count() === 1 ? $matches->first() : null;
    }
}
