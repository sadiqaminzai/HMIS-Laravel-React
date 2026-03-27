<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('surgery_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->cascadeOnDelete();
            $table->string('name', 191);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_delete')->default(false);
            $table->string('created_by', 191)->nullable();
            $table->string('updated_by', 191)->nullable();
            $table->string('deleted_by', 191)->nullable();
            $table->timestamps();

            $table->unique(['hospital_id', 'name']);
            $table->index(['hospital_id', 'is_active', 'is_delete']);
        });

        Schema::create('surgeries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->cascadeOnDelete();
            $table->string('name', 191);
            $table->foreignId('type_id')->constrained('surgery_types')->restrictOnDelete();
            $table->decimal('cost', 12, 2)->default(0);
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_delete')->default(false);
            $table->string('created_by', 191)->nullable();
            $table->string('updated_by', 191)->nullable();
            $table->string('deleted_by', 191)->nullable();
            $table->timestamps();

            $table->index(['hospital_id', 'type_id']);
            $table->index(['hospital_id', 'is_active', 'is_delete']);
        });

        Schema::create('patient_surgeries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->cascadeOnDelete();
            $table->foreignId('patient_id')->constrained()->restrictOnDelete();
            $table->foreignId('doctor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('surgery_id')->constrained('surgeries')->restrictOnDelete();
            $table->date('surgery_date');
            $table->enum('status', ['scheduled', 'in_progress', 'completed', 'cancelled'])->default('scheduled');
            $table->enum('payment_status', ['pending', 'paid', 'partial', 'cancelled'])->default('pending');
            $table->decimal('cost', 12, 2)->default(0);
            $table->text('notes')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_delete')->default(false);
            $table->string('created_by', 191)->nullable();
            $table->string('updated_by', 191)->nullable();
            $table->string('deleted_by', 191)->nullable();
            $table->timestamps();

            $table->index(['hospital_id', 'patient_id', 'doctor_id']);
            $table->index(['hospital_id', 'status', 'payment_status']);
            $table->index(['hospital_id', 'surgery_date']);
            $table->index(['hospital_id', 'is_active', 'is_delete']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('patient_surgeries');
        Schema::dropIfExists('surgeries');
        Schema::dropIfExists('surgery_types');
    }
};
