<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_movements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->cascadeOnDelete();
            $table->foreignId('medicine_id')->constrained('medicines')->cascadeOnDelete();
            $table->foreignId('trx_id')->nullable()->constrained('transactions')->nullOnDelete();
            $table->string('trx_type', 20)->nullable();
            $table->string('batch_no')->nullable();
            $table->date('expiry_date')->nullable();
            $table->integer('qty_change')->default(0);
            $table->integer('bonus_change')->default(0);
            $table->decimal('unit_price', 15, 2)->default(0);
            $table->unsignedInteger('balance_qty')->default(0);
            $table->unsignedInteger('balance_bonus')->default(0);
            $table->string('actor')->nullable();
            $table->boolean('is_reversal')->default(false);
            $table->timestamps();

            $table->index(['hospital_id', 'medicine_id']);
            $table->index(['trx_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_movements');
    }
};
