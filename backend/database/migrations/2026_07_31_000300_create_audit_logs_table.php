<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            // Nullable so failed logins (no resolved user/tenant) are still recorded.
            $table->unsignedBigInteger('hospital_id')->nullable();
            $table->unsignedBigInteger('user_id')->nullable();
            // Denormalised so the trail survives a user rename or deletion.
            $table->string('user_name', 191)->nullable();
            $table->string('user_role', 100)->nullable();
            $table->string('module', 100);
            $table->string('action', 50);
            $table->string('record_id', 100)->nullable();
            $table->string('record_label', 191)->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->string('url', 512)->nullable();
            $table->string('method', 10)->nullable();
            $table->text('description')->nullable();
            $table->timestamps();

            $table->foreign('hospital_id')->references('id')->on('hospitals')->onDelete('cascade');
            $table->foreign('user_id')->references('id')->on('users')->onDelete('set null');
            $table->index(['hospital_id', 'created_at']);
            $table->index(['hospital_id', 'module']);
            $table->index(['hospital_id', 'action']);
            $table->index(['hospital_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('audit_logs');
    }
};
