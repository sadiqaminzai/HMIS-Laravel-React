<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who filed the ultrasound report, recorded apart from who took the money.
 *
 * The receipts list showed "paid by" under every exam, and nothing at all for
 * the radiologist -- so the only name on the row was the collector's, and when
 * the radiologist also held the right to collect, her name read as though she
 * had done the cashier's job. Completion now has its own name and time,
 * stamped from the logged-in user when the report is submitted.
 *
 * EXISTING DATA. Both columns start empty on every exam already on file. Who
 * completed an old report was never recorded anywhere, and filling it with a
 * guess (updated_by, the doctor on the row) would put a name on a record that
 * the person may never have touched. Only reports submitted from now on carry
 * one.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('ultrasound_exams')) {
            return;
        }

        Schema::table('ultrasound_exams', function (Blueprint $table) {
            if (!Schema::hasColumn('ultrasound_exams', 'completed_by')) {
                $table->string('completed_by', 191)->nullable()->after('status');
            }
            if (!Schema::hasColumn('ultrasound_exams', 'completed_at')) {
                $table->timestamp('completed_at')->nullable()->after('completed_by');
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('ultrasound_exams')) {
            return;
        }

        Schema::table('ultrasound_exams', function (Blueprint $table) {
            foreach (['completed_at', 'completed_by'] as $column) {
                if (Schema::hasColumn('ultrasound_exams', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
