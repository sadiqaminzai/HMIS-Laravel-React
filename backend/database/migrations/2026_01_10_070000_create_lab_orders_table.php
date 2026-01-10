<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Main Lab Orders table
        Schema::create('lab_orders', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('hospital_id');
            $table->string('order_number', 50)->unique();
            $table->unsignedBigInteger('patient_id')->nullable();
            $table->unsignedBigInteger('walk_in_patient_id')->nullable();
            $table->boolean('is_walk_in')->default(false);
            $table->string('patient_name', 255);
            $table->unsignedTinyInteger('patient_age');
            $table->enum('patient_gender', ['male', 'female', 'other']);
            $table->unsignedBigInteger('doctor_id');
            $table->string('doctor_name', 255);
            $table->decimal('total_amount', 10, 2)->default(0);
            $table->decimal('paid_amount', 10, 2)->default(0);
            $table->enum('payment_status', ['unpaid', 'partial', 'paid'])->default('unpaid');
            $table->string('payment_method', 50)->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('paid_by', 191)->nullable();
            $table->string('receipt_number', 50)->nullable();
            $table->enum('status', ['pending', 'sample_collected', 'processing', 'completed', 'cancelled'])->default('pending');
            $table->enum('priority', ['normal', 'urgent', 'stat'])->default('normal');
            $table->text('clinical_notes')->nullable();
            $table->unsignedBigInteger('assigned_to')->nullable();
            $table->string('assigned_to_name', 191)->nullable();
            $table->timestamp('sample_collected_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->text('remarks')->nullable();
            $table->string('created_by', 191)->nullable();
            $table->string('updated_by', 191)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('hospital_id')->references('id')->on('hospitals')->onDelete('cascade');
            $table->foreign('patient_id')->references('id')->on('patients')->onDelete('set null');
            $table->foreign('doctor_id')->references('id')->on('doctors')->onDelete('cascade');
            $table->index(['hospital_id', 'status']);
            $table->index(['hospital_id', 'payment_status']);
            $table->index(['hospital_id', 'created_at']);
        });

        // Lab Order Items (tests in each order)
        Schema::create('lab_order_items', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lab_order_id');
            $table->unsignedBigInteger('test_template_id');
            $table->string('test_code', 100);
            $table->string('test_name', 255);
            $table->string('test_type', 100);
            $table->string('sample_type', 100);
            $table->decimal('price', 10, 2)->default(0);
            $table->enum('status', ['pending', 'processing', 'completed'])->default('pending');
            $table->timestamp('started_at')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->string('completed_by', 191)->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->foreign('lab_order_id')->references('id')->on('lab_orders')->onDelete('cascade');
            $table->foreign('test_template_id')->references('id')->on('test_templates')->onDelete('cascade');
            $table->index(['lab_order_id', 'status']);
        });

        // Lab Order Results (results for each parameter)
        Schema::create('lab_order_results', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('lab_order_item_id');
            $table->unsignedBigInteger('parameter_id')->nullable();
            $table->string('parameter_name', 255);
            $table->string('unit', 50)->nullable();
            $table->string('normal_range', 255)->nullable();
            $table->string('result_value', 255)->nullable();
            $table->enum('result_status', ['normal', 'low', 'high', 'critical'])->nullable();
            $table->text('remarks')->nullable();
            $table->string('entered_by', 191)->nullable();
            $table->timestamp('entered_at')->nullable();
            $table->timestamps();

            $table->foreign('lab_order_item_id')->references('id')->on('lab_order_items')->onDelete('cascade');
            $table->foreign('parameter_id')->references('id')->on('test_template_parameters')->onDelete('set null');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lab_order_results');
        Schema::dropIfExists('lab_order_items');
        Schema::dropIfExists('lab_orders');
    }
};
