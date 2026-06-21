<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        /*
        Schema::create('sale_invoices', function (Blueprint $table) {
            $table->id();  // Primary Key
            $table->unsignedBigInteger('patient_id');  // Foreign Key to Patient
            $table->unsignedBigInteger('doctor_id')->nullable();
            $table->string('invoice_no', 50)->unique(); 
            $table->date('invoice_date');  
            $table->dateTime('print_date')->nullable();  
            $table->decimal('total_amount', 10, 2)->nullable();
            $table->decimal('total_discount', 10, 2)->nullable();
            $table->integer('total_quantity')->nullable();
            $table->decimal('net_amount', 10, 2)->nullable();
            $table->decimal('paid_amount', 10, 2)->nullable();
            $table->decimal('due_amount', 10, 2)->nullable();
            $table->unsignedBigInteger('discount_id')->nullable();  // Foreign Key to Discount
            $table->string('discount_reason')->nullable();  
            $table->enum('payment_status', ['pending', 'paid'])->default('pending');  
            $table->enum('payment_method', ['cash', 'card', 'insurance'])->nullable();  
            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->unsignedBigInteger('deleted_by')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_delete')->default(false);
            $table->timestamps();  // created_at
            $table->softDeletes();  // deleted_at
        */
        Schema::create('return_invoice_receipts', function (Blueprint $table) {
            
            $table->id();  // Primary Key (return_invoice_id)
            $table->unsignedBigInteger('patient_id');
            $table->decimal('return_invoice_amount', 10, 2);
            $table->enum('status', ['approved', 'pending']);
            $table->unsignedBigInteger('approved_by')->nullable();
            $table->unsignedBigInteger('created_by');
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->unsignedBigInteger('deleted_by')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_delete')->default(false);
            $table->timestamps();  // created_at, updated_at
            $table->softDeletes();  // deleted_at
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('return_invoice_receipts');
    }
};
