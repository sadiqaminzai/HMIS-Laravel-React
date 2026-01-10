<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('prescriptions', function (Blueprint $table) {
            $table->boolean('is_walk_in')->default(false)->after('patient_id');
            $table->foreignId('walk_in_patient_id')->nullable()->after('patient_id')->constrained('walk_in_patients')->nullOnDelete();
            $table->foreignId('patient_id')->nullable()->change();
            $table->index(['hospital_id', 'is_walk_in']);
        });
    }

    public function down(): void
    {
        Schema::table('prescriptions', function (Blueprint $table) {
            $table->dropIndex(['hospital_id', 'is_walk_in']);
            $table->dropConstrainedForeignId('walk_in_patient_id');
            $table->dropColumn('is_walk_in');
            // Revert patient_id to not nullable
            $table->foreignId('patient_id')->nullable(false)->change();
        });
    }
};
