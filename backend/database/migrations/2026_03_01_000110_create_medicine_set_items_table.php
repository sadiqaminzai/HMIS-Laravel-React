<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('medicine_set_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('medicine_set_id')->constrained('medicine_sets')->cascadeOnDelete();
            $table->foreignId('medicine_id')->nullable()->constrained('medicines')->nullOnDelete();
            $table->string('medicine_name');
            $table->string('strength')->nullable();
            $table->string('dose')->nullable();
            $table->string('duration')->nullable();
            $table->string('instruction')->nullable();
            $table->unsignedInteger('quantity')->default(0);
            $table->string('type')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->index(['medicine_set_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('medicine_set_items');
    }
};
