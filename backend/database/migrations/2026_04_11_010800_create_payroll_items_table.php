<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payroll_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('hospital_id');
            $table->unsignedBigInteger('payroll_batch_id');
            $table->unsignedBigInteger('employee_id');
            $table->unsignedBigInteger('salary_structure_id')->nullable();
            $table->string('slip_number', 100)->nullable();
            $table->decimal('base_salary', 12, 2)->default(0);
            $table->decimal('allowances_total', 12, 2)->default(0);
            $table->decimal('deductions_total', 12, 2)->default(0);
            $table->decimal('attendance_days', 6, 2)->default(0);
            $table->decimal('payable_days', 6, 2)->default(0);
            $table->decimal('overtime_amount', 12, 2)->default(0);
            $table->decimal('adjustments_amount', 12, 2)->default(0);
            $table->decimal('final_amount', 12, 2)->default(0);
            $table->enum('status', ['pending', 'approved', 'paid', 'voided'])->default('pending');
            $table->date('paid_at')->nullable();
            $table->string('payment_method', 50)->nullable();
            $table->text('notes')->nullable();
            $table->string('created_by', 191)->nullable();
            $table->string('updated_by', 191)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('hospital_id')->references('id')->on('hospitals')->onDelete('cascade');
            $table->foreign('payroll_batch_id')->references('id')->on('payroll_batches')->onDelete('cascade');
            $table->foreign('employee_id')->references('id')->on('employees')->onDelete('cascade');
            $table->foreign('salary_structure_id')->references('id')->on('salary_structures')->nullOnDelete();

            $table->unique(['payroll_batch_id', 'employee_id']);
            $table->index(['hospital_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payroll_items');
    }
};
