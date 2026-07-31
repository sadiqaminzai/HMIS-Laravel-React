<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ultrasound_types', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('hospital_id');
            $table->string('name', 191);
            $table->string('code', 50)->nullable();
            $table->text('description')->nullable();
            // Default report body loaded into the editor when this type is picked.
            // Stored as HTML so the rich text editor can round-trip it unchanged.
            $table->longText('default_template')->nullable();
            $table->decimal('price', 12, 2)->default(0);
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->string('created_by', 191)->nullable();
            $table->string('updated_by', 191)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('hospital_id')->references('id')->on('hospitals')->onDelete('cascade');
            $table->unique(['hospital_id', 'name']);
            $table->index(['hospital_id', 'is_active']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ultrasound_types');
    }
};
