<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('test_templates', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('hospital_id');
            $table->string('test_code', 100);
            $table->string('test_name', 255);
            $table->string('test_type', 100);
            $table->string('category', 100)->default('Routine');
            $table->text('description')->nullable();
            $table->string('sample_type', 100);
            $table->decimal('price', 10, 2)->default(0);
            $table->string('duration', 100)->nullable();
            $table->text('instructions')->nullable();
            $table->enum('status', ['active', 'inactive'])->default('active');
            $table->string('created_by', 191)->nullable();
            $table->string('updated_by', 191)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('hospital_id')->references('id')->on('hospitals')->onDelete('cascade');
            $table->unique(['hospital_id', 'test_code']);
        });

        Schema::create('test_template_parameters', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('test_template_id');
            $table->string('name', 255);
            $table->string('unit', 50)->nullable();
            $table->string('normal_range', 255)->nullable();
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->timestamps();

            $table->foreign('test_template_id')
                ->references('id')
                ->on('test_templates')
                ->onDelete('cascade');
            $table->index(['test_template_id', 'sort_order']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('test_template_parameters');
        Schema::dropIfExists('test_templates');
    }
};
