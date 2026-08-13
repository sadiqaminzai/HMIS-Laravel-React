<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who registered and last changed a patient.
 *
 * The Patient Details modal has always shown "Created By" and "Updated By"
 * rows, but the columns behind them never existed, so both always rendered a
 * dash. Attribution matters here: a patient record is the anchor for every
 * appointment, prescription and invoice that follows.
 *
 * A plain name string rather than a foreign key, matching the convention
 * already used by transactions and medicines, so the record survives the
 * deletion of the user who created it.
 *
 * Nullable: rows that predate this migration simply carry no attribution.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            if (!Schema::hasColumn('patients', 'created_by')) {
                $table->string('created_by')->nullable()->after('status');
            }
            if (!Schema::hasColumn('patients', 'updated_by')) {
                $table->string('updated_by')->nullable()->after('created_by');
            }
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            foreach (['updated_by', 'created_by'] as $column) {
                if (Schema::hasColumn('patients', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
