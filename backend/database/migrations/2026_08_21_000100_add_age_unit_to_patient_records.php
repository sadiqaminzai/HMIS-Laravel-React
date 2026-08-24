<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Record whether a patient's age is counted in years or in months.
 *
 * Age was a bare number, which always meant years -- so the patients a
 * paediatric counter sees most could not be described at all. A three-month-old
 * was registered as 0 and printed on every later document as "0 Years", giving
 * a clinician no way to tell a newborn from a toddler.
 *
 * The number stays in the existing column and a unit is added beside it, rather
 * than splitting into years-plus-months. That was the first attempt and it was
 * wrong: converting 15 months into 1 year 3 months discards what the family
 * actually said, and an infant's age is quoted the way it was given. One number
 * and one unit round-trips exactly -- 15 M is stored as 15 M and reads back as
 * 15 M on the register, the card and every printout.
 *
 * Days are included for the same reason as months: a neonate is days old, and
 * a ward that cannot record that has to round to zero.
 *
 * A date of birth would be the stricter model, but it is not information this
 * counter reliably has: families give an approximate age, not a birthday.
 *
 * Applied to the snapshot columns too. Those are copies frozen when a document
 * is raised, so an old prescription still shows the age the patient was that
 * day; without a unit beside each, every infant document would keep printing
 * years however the register was fixed.
 */
return new class extends Migration
{
    /** table => the age column the unit sits beside. */
    private const TARGETS = [
        'patients' => 'age',
        'walk_in_patients' => 'age',
        'appointments' => 'patient_age',
        'lab_orders' => 'patient_age',
        'prescriptions' => 'patient_age',
    ];

    private function unitColumn(string $ageColumn): string
    {
        return $ageColumn === 'age' ? 'age_unit' : 'patient_age_unit';
    }

    public function up(): void
    {
        foreach (self::TARGETS as $table => $ageColumn) {
            if (!Schema::hasTable($table) || !Schema::hasColumn($table, $ageColumn)) {
                continue;
            }

            $unit = $this->unitColumn($ageColumn);
            if (Schema::hasColumn($table, $unit)) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($unit, $ageColumn) {
                // Existing rows are all ages in years, which is what the column
                // has always meant, so the default backfills them correctly.
                $blueprint->enum($unit, ['year', 'month', 'day'])->default('year')->after($ageColumn);
            });
        }
    }

    public function down(): void
    {
        foreach (self::TARGETS as $table => $ageColumn) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            $unit = $this->unitColumn($ageColumn);
            if (!Schema::hasColumn($table, $unit)) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($unit) {
                $blueprint->dropColumn($unit);
            });
        }
    }
};
