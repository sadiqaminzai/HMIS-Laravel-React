<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ledger_entries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hospital_id')->constrained()->cascadeOnDelete();
            $table->string('source_type', 50);
            $table->unsignedBigInteger('source_id');
            $table->string('event_type', 50)->default('snapshot');
            $table->unsignedInteger('revision')->default(1);
            $table->enum('entry_direction', ['income', 'expense', 'adjustment'])->default('adjustment');
            $table->string('module', 50);
            $table->string('category', 80)->nullable();
            $table->string('title', 191);
            $table->foreignId('patient_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('supplier_id')->nullable()->constrained()->nullOnDelete();
            $table->decimal('amount', 15, 2)->default(0);
            $table->decimal('discount_amount', 15, 2)->default(0);
            $table->decimal('tax_amount', 15, 2)->default(0);
            $table->decimal('net_amount', 15, 2)->default(0);
            $table->decimal('paid_amount', 15, 2)->default(0);
            $table->decimal('due_amount', 15, 2)->default(0);
            $table->string('currency', 10)->default('AFN');
            $table->string('status', 40)->default('pending');
            $table->timestamp('posted_at')->nullable();
            $table->timestamp('voided_at')->nullable();
            $table->string('posted_by', 191)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['hospital_id', 'source_type', 'source_id', 'event_type', 'revision'], 'ledger_source_event_revision_unique');
            $table->index(['hospital_id', 'posted_at'], 'ledger_hospital_posted_at_idx');
            $table->index(['hospital_id', 'module', 'entry_direction'], 'ledger_hospital_module_direction_idx');
            $table->index(['hospital_id', 'status', 'due_amount'], 'ledger_hospital_status_due_idx');
            $table->index(['patient_id', 'posted_at'], 'ledger_patient_posted_at_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ledger_entries');
    }
};
