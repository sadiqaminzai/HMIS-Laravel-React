<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patient_surgeries', function (Blueprint $table) {
            $table->date('discharge_date')->nullable()->after('surgery_date');
            $table->longText('discharge_summary')->nullable()->after('notes');
            $table->string('discharge_created_by', 191)->nullable()->after('discharge_summary');
            $table->string('discharge_completed_by', 191)->nullable()->after('discharge_created_by');
            $table->index(['hospital_id', 'discharge_date'], 'patient_surgeries_hospital_discharge_date_idx');
        });
    }

    public function down(): void
    {
        Schema::table('patient_surgeries', function (Blueprint $table) {
            $table->dropIndex('patient_surgeries_hospital_discharge_date_idx');
            $table->dropColumn([
                'discharge_date',
                'discharge_summary',
                'discharge_created_by',
                'discharge_completed_by',
            ]);
        });
    }
};
