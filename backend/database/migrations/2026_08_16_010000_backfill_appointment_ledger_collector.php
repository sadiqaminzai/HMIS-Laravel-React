<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Attribute existing appointment ledger entries to whoever registered them.
 *
 * LedgerPostingService wrote a hardcoded null into posted_by for appointments
 * while every other module recorded the user, so registration fees could not be
 * attributed to the desk that collected them. The appointments table did record
 * created_by/updated_by all along, so the information exists and only needs
 * copying across.
 *
 * Appointments taken before created_by was captured have nothing to copy and
 * stay unattributed, which is honest -- the collector genuinely was not
 * recorded. Only null entries are touched, so nothing already attributed is
 * overwritten.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('ledger_entries')
            ->where('module', 'appointments')
            ->whereNull('posted_by')
            ->orderBy('id')
            ->chunkById(500, function ($entries) {
                foreach ($entries as $entry) {
                    if ($entry->source_type !== 'appointment' || !$entry->source_id) {
                        continue;
                    }

                    $appointment = DB::table('appointments')
                        ->where('id', $entry->source_id)
                        ->first(['created_by', 'updated_by']);

                    $collector = $appointment?->updated_by ?: $appointment?->created_by;

                    if (!$collector) {
                        continue;
                    }

                    DB::table('ledger_entries')
                        ->where('id', $entry->id)
                        ->update(['posted_by' => $collector]);
                }
            });
    }

    public function down(): void
    {
        // Deliberately not reversible: restoring null would discard correct
        // attribution, and the previous state carried no information.
    }
};
