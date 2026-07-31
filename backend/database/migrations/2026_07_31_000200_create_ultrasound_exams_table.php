<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ultrasound_exams', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('hospital_id');
            $table->unsignedInteger('sequence_id');
            $table->unsignedBigInteger('patient_id');
            $table->unsignedBigInteger('doctor_id')->nullable();
            $table->unsignedBigInteger('ultrasound_type_id');
            $table->dateTime('examined_at');
            $table->string('referred_by', 191)->nullable();
            $table->text('clinical_notes')->nullable();
            // Edited copy of the type's default_template, saved against the patient.
            $table->longText('report_body')->nullable();
            $table->text('impression')->nullable();
            $table->enum('status', ['draft', 'completed', 'cancelled'])->default('draft');
            $table->decimal('fee', 12, 2)->default(0);
            $table->string('created_by', 191)->nullable();
            $table->string('updated_by', 191)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('hospital_id')->references('id')->on('hospitals')->onDelete('cascade');
            $table->foreign('patient_id')->references('id')->on('patients')->onDelete('cascade');
            // Doctors are users (see 2026_01_25_000074_update_prescriptions_doctor_fk_to_users);
            // the legacy `doctors` table is only a synced profile mirror.
            $table->foreign('doctor_id')->references('id')->on('users')->onDelete('set null');
            $table->foreign('ultrasound_type_id')->references('id')->on('ultrasound_types')->onDelete('restrict');
            $table->unique(['hospital_id', 'sequence_id']);
            $table->index(['hospital_id', 'examined_at']);
            $table->index(['hospital_id', 'patient_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ultrasound_exams');
    }
};
