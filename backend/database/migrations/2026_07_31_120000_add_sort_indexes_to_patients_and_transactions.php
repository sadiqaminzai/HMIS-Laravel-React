<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Now that clients page through the full patient and transaction lists, the
 * ORDER BY columns need to be indexed. Without these, MySQL filesorts the whole
 * hospital's rows on every page request:
 *
 *   patients:     WHERE hospital_id = ? ORDER BY name
 *   transactions: WHERE hospital_id = ? ORDER BY created_at DESC
 *
 * The existing indexes cover (hospital_id, patient_id) and (hospital_id, trx_type),
 * neither of which helps those sorts.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->index(['hospital_id', 'name'], 'patients_hospital_id_name_index');
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->index(['hospital_id', 'created_at'], 'transactions_hospital_id_created_at_index');
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            $table->dropIndex('patients_hospital_id_name_index');
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->dropIndex('transactions_hospital_id_created_at_index');
        });
    }
};
