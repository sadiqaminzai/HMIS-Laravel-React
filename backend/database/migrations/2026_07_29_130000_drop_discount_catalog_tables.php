<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('appointments', 'discount_type_id')) {
            Schema::table('appointments', function (Blueprint $table) {
                $table->dropConstrainedForeignId('discount_type_id');
            });
        }

        Schema::dropIfExists('discounts');
        Schema::dropIfExists('discount_types');
    }

    public function down(): void
    {
        Schema::create('discount_types', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->cascadeOnDelete();
            $table->string('name', 191);
            $table->boolean('is_active')->default(true);
            $table->boolean('is_delete')->default(false);
            $table->string('created_by', 191)->nullable();
            $table->string('updated_by', 191)->nullable();
            $table->string('deleted_by', 191)->nullable();
            $table->timestamps();

            $table->unique(['hospital_id', 'name']);
            $table->index(['hospital_id', 'is_active', 'is_delete']);
        });

        Schema::create('discounts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->cascadeOnDelete();
            $table->string('name', 191);
            $table->foreignId('discount_type_id')->constrained('discount_types')->restrictOnDelete();
            $table->decimal('amount', 12, 2)->default(0);
            $table->string('currency', 10)->default('AFN');
            $table->boolean('is_active')->default(true);
            $table->boolean('is_delete')->default(false);
            $table->string('created_by', 191)->nullable();
            $table->string('updated_by', 191)->nullable();
            $table->string('deleted_by', 191)->nullable();
            $table->timestamps();

            $table->index(['hospital_id', 'discount_type_id']);
            $table->index(['hospital_id', 'is_active', 'is_delete']);
        });

        Schema::table('appointments', function (Blueprint $table) {
            $table->foreignId('discount_type_id')
                ->nullable()
                ->after('discount_enabled')
                ->constrained('discount_types')
                ->nullOnDelete();
        });
    }
};
