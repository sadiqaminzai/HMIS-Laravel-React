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
        Schema::create('purchases', function (Blueprint $table) {
            $table->id();  // Primary Key
            $table->unsignedBigInteger('supplier_id');  // Foreign Key to Supplier
            $table->string('purchase_no', 50);
            $table->date('purchase_date');
            $table->string('bilty_no', 50)->nullable();
            $table->string('invoice_no', 50)->nullable();
            $table->unsignedBigInteger('created_by');  // Foreign Key to User
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->unsignedBigInteger('deleted_by')->nullable();
            $table->boolean('is_active')->default(true);
            $table->boolean('is_delete')->default(false);
            $table->timestamps();  // Auto timestamp
            $table->softDeletes();  // deleted_at
            $table->decimal('total_amount', 10, 2)->nullable();
            $table->decimal('total_discount', 10, 2)->nullable();
            $table->integer('total_quantity')->nullable();
            $table->decimal('net_amount', 10, 2)->nullable();
            $table->decimal('paid_amount', 10, 2)->nullable();
            $table->decimal('due_amount', 10, 2)->nullable();

            // Foreign Key
            // $table->foreign('supplier_id')->references('id')->on('suppliers')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('purchases');
    }
};
