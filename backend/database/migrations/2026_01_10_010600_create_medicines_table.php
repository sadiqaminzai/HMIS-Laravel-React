<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('medicines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->cascadeOnDelete();
            $table->foreignId('manufacturer_id')->constrained('manufacturers')->cascadeOnDelete();
            $table->foreignId('medicine_type_id')->constrained('medicine_types')->cascadeOnDelete();
            $table->string('brand_name');
            $table->string('generic_name')->nullable();
            $table->string('strength')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['hospital_id', 'status']);
            $table->index(['hospital_id', 'brand_name']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medicines');
    }
};
