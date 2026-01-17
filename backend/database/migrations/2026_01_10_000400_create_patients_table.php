<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('patients', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
            $table->string('patient_id');
            $table->string('name');
            $table->unsignedSmallInteger('age')->nullable();
            $table->enum('gender', ['male', 'female', 'other'])->default('other');
            $table->string('phone')->nullable();
            $table->string('address')->nullable();
            $table->foreignId('referred_doctor_id')->nullable()->constrained('doctors')->nullOnDelete();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->string('image_path')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->unique(['hospital_id', 'patient_id']);
            $table->index(['hospital_id', 'patient_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patients');
    }
};
