<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Record WHO took the money on appointments, surgeries and room bookings.
 *
 * Lab orders and ultrasound exams already carry payment_method / paid_at /
 * paid_by. These three carried only payment_status, so once a fee was marked
 * paid there was nothing to say which desk collected it. The day-end handover
 * therefore fell back to ledger_entries.posted_by -- which is updated_by, the
 * LAST person to save the document. Any later edit (adding a test, correcting a
 * bed number) silently moved that cash from the cashier's handover to the
 * clerk's, which is why a single user has had to do both jobs.
 *
 * Same three columns, same names, same order as the two modules that already
 * have them, so one reporting query can cover all five.
 */
return new class extends Migration
{
    /** table => column the new fields are inserted after. */
    private const TARGETS = [
        'appointments' => 'payment_status',
        'patient_surgeries' => 'payment_status',
        'room_bookings' => 'payment_status',
    ];

    public function up(): void
    {
        foreach (self::TARGETS as $table => $after) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($table, $after) {
                if (!Schema::hasColumn($table, 'payment_method')) {
                    $blueprint->string('payment_method', 50)->nullable()->after($after);
                }
                if (!Schema::hasColumn($table, 'paid_at')) {
                    $blueprint->timestamp('paid_at')->nullable()->after('payment_method');
                }
                if (!Schema::hasColumn($table, 'paid_by')) {
                    $blueprint->string('paid_by', 191)->nullable()->after('paid_at');
                }
            });

            // Seed history from the best signal that exists. updated_by is only
            // an approximation of who collected -- it is whoever saved last --
            // but it is exactly what the handover report already attributes
            // these rows to, so existing day-end figures do not move. New
            // collections record the truth from here on.
            DB::table($table)
                ->where('payment_status', 'paid')
                ->whereNull('paid_at')
                ->update([
                    'paid_at' => DB::raw('updated_at'),
                    'paid_by' => DB::raw('COALESCE(updated_by, created_by)'),
                ]);
        }
    }

    public function down(): void
    {
        foreach (array_keys(self::TARGETS) as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($table) {
                foreach (['paid_by', 'paid_at', 'payment_method'] as $column) {
                    if (Schema::hasColumn($table, $column)) {
                        $blueprint->dropColumn($column);
                    }
                }
            });
        }
    }
};
