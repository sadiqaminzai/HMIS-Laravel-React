<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prescriptions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained('patients')->cascadeOnDelete();
            $table->foreignId('doctor_id')->constrained('doctors')->cascadeOnDelete();
            $table->string('patient_name');
            $table->unsignedInteger('patient_age')->default(0);
            $table->string('patient_gender', 20)->nullable();
            $table->string('doctor_name');
            $table->string('prescription_number')->unique();
            $table->text('diagnosis')->nullable();
            $table->text('advice')->nullable();
            $table->enum('status', ['active', 'cancelled'])->default('active');
            $table->string('created_by')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['hospital_id', 'doctor_id']);
            $table->index(['hospital_id', 'patient_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prescriptions');
    }
};
