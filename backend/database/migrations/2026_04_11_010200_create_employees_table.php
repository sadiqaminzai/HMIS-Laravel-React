<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('employees', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('hospital_id');
            $table->unsignedBigInteger('user_id')->nullable();
            $table->unsignedBigInteger('department_id')->nullable();
            $table->unsignedBigInteger('designation_id')->nullable();
            $table->string('employee_code', 50)->nullable();
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->enum('gender', ['male', 'female', 'other']);
            $table->date('date_of_birth')->nullable();
            $table->string('phone', 50)->nullable();
            $table->string('email', 191)->nullable();
            $table->text('address')->nullable();
            $table->string('emergency_contact_name', 191)->nullable();
            $table->string('emergency_contact_phone', 50)->nullable();
            $table->date('joining_date');
            $table->enum('employment_type', ['permanent', 'contract', 'temporary', 'intern'])->default('permanent');
            $table->decimal('basic_salary', 12, 2)->default(0);
            $table->enum('status', ['active', 'inactive', 'terminated'])->default('active');
            $table->string('profile_image_path')->nullable();
            $table->string('contract_document_path')->nullable();
            $table->string('created_by', 191)->nullable();
            $table->string('updated_by', 191)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('hospital_id')->references('id')->on('hospitals')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->nullOnDelete();
            $table->foreign('department_id')->references('id')->on('departments')->nullOnDelete();
            $table->foreign('designation_id')->references('id')->on('designations')->nullOnDelete();

            $table->unique(['hospital_id', 'employee_code']);
            $table->index(['hospital_id', 'status']);
            $table->index(['hospital_id', 'joining_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};
