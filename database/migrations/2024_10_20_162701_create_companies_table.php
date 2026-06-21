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
        Schema::create('companies', function (Blueprint $table) {
            $table->id();
            $table->string('name', 100);  // Designation Name
            $table->boolean('is_active')->default(true);  // Is active or not
            $table->boolean('is_delete')->default(false);  // Is delete or not
            $table->unsignedBigInteger('created_by');  // Foreign Key to User Table
            $table->unsignedBigInteger('updated_by')->nullable();  // Foreign Key to User Table
            $table->unsignedBigInteger('deleted_by')->nullable();  // Foreign Key to User Table
            $table->timestamps();  // Created at and updated at timestamps
            $table->softDeletes();  // Soft delete
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('companies');
    }
};
