<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('rooms')) {
            Schema::create('rooms', function (Blueprint $table) {
                $table->id();
                $table->foreignId('hospital_id')->constrained()->cascadeOnDelete();
                $table->string('room_number', 100);
                $table->enum('type', ['General', 'Private', 'Semi-Private', 'ICU', 'Emergency']);
                $table->unsignedInteger('total_beds');
                $table->unsignedInteger('available_beds');
                $table->decimal('cost_per_bed', 12, 2)->default(0);
                $table->boolean('is_active')->default(true);
                $table->boolean('is_delete')->default(false);
                $table->string('created_by', 191)->nullable();
                $table->string('updated_by', 191)->nullable();
                $table->string('deleted_by', 191)->nullable();
                $table->timestamps();

                $table->unique(['hospital_id', 'room_number']);
                $table->index(['hospital_id', 'type', 'is_active', 'is_delete']);
            });
        }

        if (!Schema::hasTable('room_bookings')) {
            Schema::create('room_bookings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('hospital_id')->constrained()->cascadeOnDelete();
                $table->foreignId('room_id')->constrained('rooms')->restrictOnDelete();
                $table->foreignId('patient_id')->constrained()->restrictOnDelete();
                $table->foreignId('doctor_id')->nullable()->constrained('users')->nullOnDelete();
                $table->date('booking_date');
                $table->date('check_in_date');
                $table->date('check_out_date')->nullable();
                $table->string('bed_number', 50)->nullable();
                $table->unsignedInteger('beds_to_book')->default(1);
                $table->decimal('total_cost', 12, 2)->default(0);
                $table->decimal('discount_amount', 12, 2)->default(0);
                $table->enum('status', ['Pending', 'Confirmed', 'Checked-in', 'Checked-out', 'Cancelled'])->default('Pending');
                $table->enum('payment_status', ['pending', 'paid', 'partial', 'cancelled'])->default('pending');
                $table->text('remarks')->nullable();
                $table->boolean('is_active')->default(true);
                $table->boolean('is_delete')->default(false);
                $table->string('created_by', 191)->nullable();
                $table->string('updated_by', 191)->nullable();
                $table->string('deleted_by', 191)->nullable();
                $table->timestamps();

                $table->index(['hospital_id', 'room_id', 'check_in_date', 'check_out_date'], 'rb_hosp_room_check_dates_idx');
                $table->index(['hospital_id', 'patient_id', 'status', 'payment_status'], 'rb_hosp_patient_status_pay_idx');
                $table->index(['hospital_id', 'is_active', 'is_delete'], 'rb_hosp_active_delete_idx');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('room_bookings');
        Schema::dropIfExists('rooms');
    }
};
