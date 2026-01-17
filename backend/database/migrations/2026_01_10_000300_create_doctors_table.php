<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('doctors', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->onDelete('cascade');
            $table->string('name');
            $table->string('email')->nullable();
            $table->string('phone')->nullable();
            $table->string('specialization');
            $table->string('registration_number')->nullable();
            $table->decimal('consultation_fee', 10, 2)->default(0);
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->json('availability_schedule')->nullable();
            $table->string('image_path')->nullable();
            $table->string('signature_path')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index(['hospital_id', 'status']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->foreign('doctor_id')->references('id')->on('doctors')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['doctor_id']);
        });

        Schema::dropIfExists('doctors');
    }
};
