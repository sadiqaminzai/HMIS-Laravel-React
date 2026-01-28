<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('module_sequences', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('hospital_id');
            $table->string('module');
            $table->unsignedBigInteger('last_number')->default(0);
            $table->timestamps();

            $table->unique(['hospital_id', 'module']);
            $table->foreign('hospital_id')->references('id')->on('hospitals')->cascadeOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('module_sequences', function (Blueprint $table) {
            $table->dropForeign(['hospital_id']);
            $table->dropUnique(['hospital_id', 'module']);
        });

        Schema::dropIfExists('module_sequences');
    }
};
