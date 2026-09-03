<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * hospital_settings.default_doctor_id still referenced the legacy `doctors`
 * table after doctors became users.
 *
 * The Default Doctor dropdown lists users (that is what the doctors endpoint
 * returns now), so saving one wrote a users.id into a column whose foreign key
 * demanded a doctors.id -- and every save failed with a 1452 constraint
 * violation. The doctor-to-users migrations repointed appointments and the
 * rest; this column was missed.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('hospital_settings') || !Schema::hasColumn('hospital_settings', 'default_doctor_id')) {
            return;
        }

        if ($this->foreignKeyExists('hospital_settings_default_doctor_id_foreign')) {
            Schema::table('hospital_settings', function (Blueprint $table) {
                $table->dropForeign('hospital_settings_default_doctor_id_foreign');
            });
        }

        // Carry existing choices across where the legacy profile is linked to a
        // user account, so a hospital that had configured a default doctor
        // keeps it rather than silently losing the setting.
        if (Schema::hasTable('users') && Schema::hasColumn('users', 'doctor_id')) {
            DB::statement('
                UPDATE hospital_settings hs
                JOIN users u ON u.doctor_id = hs.default_doctor_id AND u.role = "doctor"
                SET hs.default_doctor_id = u.id
                WHERE hs.default_doctor_id IS NOT NULL
            ');
        }

        // Anything left over points at a doctor with no user account; it cannot
        // satisfy the new key, and a dangling id would fail the next save just
        // as the old one did.
        DB::statement('
            UPDATE hospital_settings
            SET default_doctor_id = NULL
            WHERE default_doctor_id IS NOT NULL
              AND default_doctor_id NOT IN (SELECT id FROM users)
        ');

        Schema::table('hospital_settings', function (Blueprint $table) {
            $table->foreign('default_doctor_id')
                ->references('id')
                ->on('users')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('hospital_settings') || !Schema::hasColumn('hospital_settings', 'default_doctor_id')) {
            return;
        }

        if ($this->foreignKeyExists('hospital_settings_default_doctor_id_foreign')) {
            Schema::table('hospital_settings', function (Blueprint $table) {
                $table->dropForeign('hospital_settings_default_doctor_id_foreign');
            });
        }

        // The old key cannot be trusted to hold against users ids, so the
        // column is cleared before it is pointed back at the legacy table.
        DB::statement('UPDATE hospital_settings SET default_doctor_id = NULL');

        Schema::table('hospital_settings', function (Blueprint $table) {
            $table->foreign('default_doctor_id')
                ->references('id')
                ->on('doctors')
                ->nullOnDelete();
        });
    }

    private function foreignKeyExists(string $name): bool
    {
        return !empty(DB::select(
            'SELECT CONSTRAINT_NAME FROM information_schema.TABLE_CONSTRAINTS
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = "hospital_settings"
               AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = "FOREIGN KEY"',
            [$name]
        ));
    }
};
