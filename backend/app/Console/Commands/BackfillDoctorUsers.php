<?php

namespace App\Console\Commands;

use App\Models\Doctor;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Recreates the user accounts that back each doctor profile.
 *
 * Doctors used to live in the `doctors` table, but appointments, prescriptions
 * and lab orders were later re-pointed at `users` (see the
 * `*_update_*_doctor_fk_to_users` migrations) and the API now lists doctors as
 * `users` with role `doctor`. Installations upgraded across that change can end
 * up with `doctors` rows that have no matching user, which makes the Doctors
 * screen — and every doctor dropdown — appear empty.
 *
 * Created accounts are inactive with an unusable password: an administrator
 * activates them and sets a password through the UI.
 */
class BackfillDoctorUsers extends Command
{
    protected $signature = 'doctors:backfill-users
        {--dry-run : Show what would change without writing anything}
        {--activate : Create the accounts already active instead of inactive}';

    protected $description = 'Create missing user accounts for doctor profiles that only exist in the doctors table';

    public function handle(): int
    {
        $dryRun = (bool) $this->option('dry-run');
        $activate = (bool) $this->option('activate');

        $doctors = Doctor::query()->orderBy('hospital_id')->orderBy('id')->get();

        if ($doctors->isEmpty()) {
            $this->info('No doctor profiles found. Nothing to do.');

            return self::SUCCESS;
        }

        // Doctor rows were duplicated by repeated profile syncs, so collapse
        // them per hospital on name + registration number and keep the newest.
        $groups = $doctors->groupBy(fn (Doctor $d) => implode('|', [
            (int) $d->hospital_id,
            Str::lower(trim((string) $d->name)),
            Str::lower(trim((string) $d->registration_number)),
        ]));

        $created = 0;
        $linked = 0;
        $skipped = 0;
        $duplicates = 0;
        $rows = [];

        foreach ($groups as $group) {
            /** @var Doctor $doctor */
            $doctor = $group->sortByDesc('id')->first();
            $duplicates += $group->count() - 1;

            $existing = $this->findExistingUser($doctor);

            if ($existing) {
                $needsLink = (int) $existing->doctor_id !== (int) $doctor->id;
                $rows[] = [$doctor->hospital_id, $doctor->name, $doctor->email ?: '—', $needsLink ? 'link existing user' : 'already ok', $group->count()];

                if ($needsLink && !$dryRun) {
                    $existing->updateQuietly(['doctor_id' => $doctor->id]);
                    $linked++;
                } elseif ($needsLink) {
                    $linked++;
                } else {
                    $skipped++;
                }

                continue;
            }

            // Resolve once: resolveEmail() claims the address, so calling it
            // twice for the same doctor would fall through to a placeholder.
            $email = $this->resolveEmail($doctor);
            $rows[] = [$doctor->hospital_id, $doctor->name, $email, 'create user', $group->count()];
            $created++;

            if ($dryRun) {
                continue;
            }

            DB::transaction(function () use ($doctor, $activate, $email) {
                $user = new User();
                $user->hospital_id = $doctor->hospital_id;
                $user->name = $doctor->name;
                $user->email = $email;
                // Unusable password: the account must be given one via the UI.
                $user->password = Hash::make(Str::random(40));
                $user->role = 'doctor';
                $user->phone = $doctor->phone;
                $user->specialization = $doctor->specialization ?: 'General';
                $user->registration_number = $doctor->registration_number;
                $user->consultation_fee = $doctor->consultation_fee ?? 0;
                $user->doctor_status = $doctor->status ?? 'active';
                $user->availability_schedule = $doctor->availability_schedule;
                $user->image_path = $doctor->image_path;
                $user->signature_path = $doctor->signature_path;
                $user->is_active = $activate;
                $user->doctor_id = $doctor->id;
                $user->created_by = 'doctors:backfill-users';
                // saveQuietly avoids User::saved -> syncDoctorProfile, which would
                // create yet another duplicate row in the doctors table.
                $user->saveQuietly();
            });
        }

        $this->table(['Hospital', 'Doctor', 'Email', 'Action', 'Profiles merged'], $rows);

        $this->newLine();
        $this->line(sprintf(
            '%s  create: %d   link: %d   unchanged: %d   duplicate profiles collapsed: %d',
            $dryRun ? '[dry run]' : '[applied]',
            $created,
            $linked,
            $skipped,
            $duplicates
        ));

        if ($dryRun) {
            $this->comment('Re-run without --dry-run to apply.');

            return self::SUCCESS;
        }

        if ($created > 0 && !$activate) {
            $this->warn('New accounts are INACTIVE with no usable password.');
            $this->warn('Activate them and set passwords under Settings -> Users.');
        }

        return self::SUCCESS;
    }

    /**
     * Match an existing doctor user by explicit link, then email, then name.
     */
    private function findExistingUser(Doctor $doctor): ?User
    {
        $byLink = User::where('doctor_id', $doctor->id)->first();
        if ($byLink) {
            return $byLink;
        }

        if (!empty($doctor->email)) {
            $byEmail = User::where('email', $doctor->email)->first();
            if ($byEmail) {
                return $byEmail;
            }
        }

        return User::where('role', 'doctor')
            ->where('hospital_id', $doctor->hospital_id)
            ->whereRaw('LOWER(name) = ?', [Str::lower(trim((string) $doctor->name))])
            ->first();
    }

    /**
     * Emails already handed out during this run.
     *
     * The legacy data contains distinct doctors sharing one email address, so
     * checking the users table alone is not enough to stay unique.
     *
     * @var array<string, true>
     */
    private array $claimedEmails = [];

    /**
     * Users require a unique email; synthesise a placeholder when the doctor's
     * own address is missing or already taken.
     */
    private function resolveEmail(Doctor $doctor): string
    {
        $email = Str::lower(trim((string) $doctor->email));

        if ($email !== '' && !isset($this->claimedEmails[$email]) && !User::where('email', $email)->exists()) {
            $this->claimedEmails[$email] = true;

            return $email;
        }

        $slug = Str::slug($doctor->name) ?: 'doctor';
        $fallback = sprintf('%s.h%d.d%d@doctors.local', $slug, $doctor->hospital_id, $doctor->id);
        $this->claimedEmails[Str::lower($fallback)] = true;

        return $fallback;
    }
}
