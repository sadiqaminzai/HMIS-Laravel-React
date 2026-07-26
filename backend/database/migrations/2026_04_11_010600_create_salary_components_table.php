<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('salary_components', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('hospital_id');
            $table->unsignedBigInteger('salary_structure_id');
            $table->enum('component_type', ['allowance', 'deduction']);
            $table->string('name', 150);
            $table->decimal('amount', 12, 2)->default(0);
            $table->boolean('is_taxable')->default(false);
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('hospital_id')->references('id')->on('hospitals')->onDelete('cascade');
            $table->foreign('salary_structure_id')->references('id')->on('salary_structures')->onDelete('cascade');
            $table->index(['salary_structure_id', 'component_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('salary_components');
    }
};
