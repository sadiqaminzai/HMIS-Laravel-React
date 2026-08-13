<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Lets a pharmacy sale be made to a walk-in customer instead of a registered
 * hospital patient, so ShifaaScript Pharmacy can run as a retail pharmacy.
 *
 * Follows the pattern already used by prescriptions and lab orders:
 *   is_walk_in (flag) + walk_in_patient_id (nullable FK)
 *
 * transactions.patient_id is already nullable and transactions.patient_name
 * already exists, so no existing column needs altering and every existing
 * hospital sale keeps working exactly as before (is_walk_in defaults to false).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            if (!Schema::hasColumn('transactions', 'is_walk_in')) {
                $table->boolean('is_walk_in')->default(false)->after('patient_id');
            }
            if (!Schema::hasColumn('transactions', 'walk_in_patient_id')) {
                $table->foreignId('walk_in_patient_id')
                    ->nullable()
                    ->after('is_walk_in')
                    ->constrained('walk_in_patients')
                    ->nullOnDelete();
            }
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->index(['hospital_id', 'is_walk_in'], 'transactions_hospital_id_is_walk_in_index');
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropIndex('transactions_hospital_id_is_walk_in_index');
        });

        Schema::table('transactions', function (Blueprint $table) {
            if (Schema::hasColumn('transactions', 'walk_in_patient_id')) {
                $table->dropConstrainedForeignId('walk_in_patient_id');
            }
            if (Schema::hasColumn('transactions', 'is_walk_in')) {
                $table->dropColumn('is_walk_in');
            }
        });
    }
};
