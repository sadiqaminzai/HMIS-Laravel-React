<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stock_reconciliations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->cascadeOnDelete();
            $table->foreignId('medicine_id')->constrained('medicines')->cascadeOnDelete();
            $table->string('batch_no')->nullable();
            $table->date('reconciliation_date');
            $table->unsignedInteger('physical_qty')->default(0);
            $table->unsignedInteger('physical_bonus')->default(0);
            $table->string('created_by')->nullable();
            $table->timestamps();

            $table->unique(['hospital_id', 'medicine_id', 'batch_no', 'reconciliation_date'], 'stock_reconcile_unique');
            $table->index(['hospital_id', 'reconciliation_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stock_reconciliations');
    }
};
