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
        Schema::create('patients', function (Blueprint $table) {
            $table->id();  // Primary Key (patient_id)
            $table->string('name');  
            $table->string('father_name')->nullable();  
            $table->string('mobile')->nullable();  
            $table->string('email')->nullable();  
            $table->integer('age'); 
            $table->string('gender')->nullable();
            $table->text('address');  
            $table->string('city')->nullable();  
            $table->string('state')->nullable();  
            $table->string('zip_code')->nullable();  
            $table->string('emergency_contact_name')->nullable();  
            $table->string('emergency_contact_number')->nullable();  
            $table->unsignedBigInteger('created_by');  
            $table->unsignedBigInteger('updated_by')->nullable();  
            $table->unsignedBigInteger('deleted_by')->nullable();  
            $table->boolean('is_active')->default(true);  
            $table->boolean('is_delete')->default(false);  
            $table->timestamps();  // created_at, updated_at
            $table->softDeletes();  // deleted_at
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('patients');
    }
};
