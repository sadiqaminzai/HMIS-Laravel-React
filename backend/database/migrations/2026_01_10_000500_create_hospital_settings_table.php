<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('hospital_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
            $table->foreignId('default_doctor_id')->nullable()->constrained('doctors')->nullOnDelete();
            $table->boolean('default_to_walk_in')->default(false);
            $table->boolean('auto_generate_patient_ids')->default(true);
            $table->string('patient_id_prefix', 10)->default('P');
            $table->unsignedInteger('patient_id_start')->default(1);
            $table->unsignedTinyInteger('patient_id_digits')->default(5);
            $table->timestamps();

            $table->unique('hospital_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('hospital_settings');
    }
};
