<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who booked and last changed an appointment.
 *
 * An appointment carries a fee, a discount and a payment status, so knowing who
 * entered it is an accountability requirement rather than a nicety -- it is the
 * first question asked when a waived fee is queried.
 *
 * Plain name strings, matching patients, medicines and transactions, so the
 * record survives the deletion of the user who created it. Nullable, so rows
 * predating this migration simply carry no attribution.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            if (!Schema::hasColumn('appointments', 'created_by')) {
                $table->string('created_by')->nullable();
            }
            if (!Schema::hasColumn('appointments', 'updated_by')) {
                $table->string('updated_by')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            foreach (['updated_by', 'created_by'] as $column) {
                if (Schema::hasColumn('appointments', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
