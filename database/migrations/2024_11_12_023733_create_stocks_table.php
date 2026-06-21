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
        Schema::create('stocks', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');
            $table->string('batch_no')->nullable();
            $table->date('mfg_date')->nullable();
            $table->date('expiry_date')->nullable();
            $table->integer('quantity');
            $table->integer('bonus')->nullable();
            $table->decimal('unit_price', 10, 2)->nullable();
            $table->decimal('discount', 10, 2)->nullable();
            $table->decimal('amount', 10, 2)->nullable();
            $table->unsignedBigInteger('transaction_id')->default(0); // Universal ID for any transaction
            $table->string('transaction_type', 60); // Type of transaction
            /*transaction_type:
                'purchase',       // For standard purchase transactions
                'purchase_return',  // For returns to suppliers, reducing inventory
                'sale_invoice',   // For sales transactions
                'return_invoice', // For returns on sales
                'transfer_in',    // For internal transfers coming into this stock location
                'transfer_out',   // For internal transfers going out from this stock location
                'stock_in',       // For any generic stock increases that don’t fall under the above types
                'stock_out'       // For any generic stock decreases (e.g., damaged goods)
            */  
        
            // User and status tracking fields
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        
            // Foreign key constraints (Optional)
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stocks');
    }
};
