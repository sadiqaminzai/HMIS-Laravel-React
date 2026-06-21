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
        Schema::create('stock_summaries', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('product_id');            
            // Opening Balance
            $table->integer('opening_quantity')->default(0);
            // Purchases and Transfers
            $table->integer('purchase_quantity')->default(0);
            $table->integer('transfer_in_quantity')->default(0);
            // Sales and Returns
            $table->integer('sale_quantity')->default(0);
            $table->integer('return_quantity')->default(0);
            // Net Sale and Transfers Out
            $table->integer('net_sale_quantity')->default(0);
            $table->integer('transfer_out_quantity')->default(0);
            // Closing Balance
            $table->integer('closing_quantity')->default(0);
            $table->decimal('closing_amount', 10, 2)->default(0);
            // Transaction tracking fields
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
            // Tracking Fields
            $table->unsignedBigInteger('created_by')->nullable();
            $table->unsignedBigInteger('updated_by')->nullable();
            $table->timestamps();
        
            // Foreign Key Constraint
            $table->foreign('product_id')->references('id')->on('products')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('stock_summaries');
    }
};
