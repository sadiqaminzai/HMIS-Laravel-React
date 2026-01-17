<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $connection = Schema::getConnection();
        $database = $connection->getDatabaseName();
        $indexName = 'patients_patient_id_unique';

        $indexExists = DB::table('information_schema.statistics')
            ->where('table_schema', $database)
            ->where('table_name', 'patients')
            ->where('index_name', $indexName)
            ->exists();

        Schema::table('patients', function (Blueprint $table) use ($indexExists, $indexName) {
            if ($indexExists) {
                $table->dropUnique($indexName);
            }
            $table->unique(['hospital_id', 'patient_id'], 'patients_hospital_patient_unique');
        });
    }

    public function down(): void
    {
        $connection = Schema::getConnection();
        $database = $connection->getDatabaseName();
        $indexName = 'patients_hospital_patient_unique';

        $indexExists = DB::table('information_schema.statistics')
            ->where('table_schema', $database)
            ->where('table_name', 'patients')
            ->where('index_name', $indexName)
            ->exists();

        Schema::table('patients', function (Blueprint $table) use ($indexExists, $indexName) {
            if ($indexExists) {
                $table->dropUnique($indexName);
            }
            $table->unique('patient_id');
        });
    }
};
