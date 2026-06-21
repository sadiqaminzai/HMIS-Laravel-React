<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('patient_surgeries', function (Blueprint $table) {
            // Add status column if it doesn't exist
            if (!Schema::hasColumn('patient_surgeries', 'status')) {
                $table->string('status')->default('scheduled')->after('surgery_date');
            }
            
            // Add doctor_id column with foreign key reference to employees table
            if (!Schema::hasColumn('patient_surgeries', 'doctor_id')) {
                $table->foreignId('doctor_id')->nullable()->after('surgery_id')
                    ->constrained('employees')->nullOnDelete();
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('patient_surgeries', function (Blueprint $table) {
            // Drop columns in reverse order
            if (Schema::hasColumn('patient_surgeries', 'doctor_id')) {
                $table->dropForeign(['doctor_id']);
                $table->dropColumn('doctor_id');
            }
            
            if (Schema::hasColumn('patient_surgeries', 'status')) {
                $table->dropColumn('status');
            }
        });
    }
};