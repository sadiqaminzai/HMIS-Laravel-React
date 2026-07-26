<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_batches', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('hospital_id');
            $table->string('payroll_month', 7); // YYYY-MM
            $table->enum('status', ['draft', 'generated', 'approved', 'posted', 'voided'])->default('draft');
            $table->unsignedInteger('total_employees')->default(0);
            $table->decimal('gross_amount', 14, 2)->default(0);
            $table->decimal('deductions_amount', 14, 2)->default(0);
            $table->decimal('net_amount', 14, 2)->default(0);
            $table->string('currency', 10)->default('AFN');
            $table->string('generated_by', 191)->nullable();
            $table->string('approved_by', 191)->nullable();
            $table->string('posted_by', 191)->nullable();
            $table->timestamp('generated_at')->nullable();
            $table->timestamp('approved_at')->nullable();
            $table->timestamp('posted_at')->nullable();
            $table->text('notes')->nullable();
            $table->string('created_by', 191)->nullable();
            $table->string('updated_by', 191)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('hospital_id')->references('id')->on('hospitals')->onDelete('cascade');
            $table->unique(['hospital_id', 'payroll_month']);
            $table->index(['hospital_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_batches');
    }
};
