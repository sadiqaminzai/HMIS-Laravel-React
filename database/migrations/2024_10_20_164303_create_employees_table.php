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
        Schema::create('employees', function (Blueprint $table) {
            $table->id();  // Primary Key (id column)
            $table->string('first_name', 100);
            $table->string('last_name', 100);
            $table->string('employee_code', 10)->unique();
            $table->unsignedBigInteger('department_id');  
            $table->unsignedBigInteger('designation_id');
            $table->string('specialty', 255)->nullable();  
            $table->integer('experience_years')->nullable();
            $table->string('email', 100)->unique();
            $table->string('phone_number', 15)->nullable();
            $table->text('address')->nullable();
            $table->date('hire_date');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_delete')->default(false);
            $table->unsignedBigInteger('created_by');  
            $table->unsignedBigInteger('updated_by')->nullable();  
            $table->unsignedBigInteger('deleted_by')->nullable();  
            $table->timestamps();  
            $table->softDeletes();  

            // Foreign Keys
            // $table->foreign('department_id')->references('id')->on('departments');
            // $table->foreign('designation_id')->references('id')->on('designations');  
            // $table->foreign('created_by')->references('id')->on('users');  
            // $table->foreign('updated_by')->references('id')->on('users');
            // $table->foreign('deleted_by')->references('id')->on('users');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('employees');
    }
};
