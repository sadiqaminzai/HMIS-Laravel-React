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
        Schema::create('users', function (Blueprint $table) {
            $table->id();
            // Nullable for Super Admins who manage the whole system
            $table->unsignedBigInteger('hospital_id')->nullable();

            $table->string('name');
            $table->string('email')->unique();
            $table->string('phone')->nullable();
            $table->string('password');

            $table->enum('role', ['super_admin', 'admin', 'doctor', 'receptionist', 'pharmacist', 'lab_technician']);
            $table->unsignedBigInteger('doctor_id')->nullable();
            $table->string('specialization')->nullable();
            $table->string('registration_number')->nullable();
            $table->decimal('consultation_fee', 10, 2)->default(0);
            $table->enum('doctor_status', ['active', 'inactive'])->nullable()->default('active');
            $table->json('availability_schedule')->nullable();
            $table->string('image_path')->nullable();
            $table->string('signature_path')->nullable();
            $table->string('avatar_path')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamp('last_login_at')->nullable();

            $table->rememberToken();
            $table->timestamps();
            $table->softDeletes();

            // Index for faster tenant scoping
            $table->index(['hospital_id', 'role']);
            $table->index('doctor_id');
        });

        Schema::create('password_reset_tokens', function (Blueprint $table) {
            $table->string('email')->primary();
            $table->string('token');
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('sessions', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->foreignId('user_id')->nullable()->index();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->longText('payload');
            $table->integer('last_activity')->index();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('users');
        Schema::dropIfExists('password_reset_tokens');
        Schema::dropIfExists('sessions');
    }
};
