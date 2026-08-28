<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * X-Ray takings, as a receipt desk rather than a reporting workflow.
 *
 * X-Ray belongs to radiology alongside ultrasound, but unlike ultrasound the
 * film is read and reported outside ShifaaScript -- so there is no exam record
 * and no report template, only the money. That is why this is a single table
 * with a fee on it and not a copy of the ultrasound_types/ultrasound_exams
 * pair: modelling studies the system never reports on would be scaffolding
 * nobody fills in.
 *
 * The discount columns mirror appointments and patient surgeries so a hospital
 * running a campaign records it the same way everywhere, and the ledger gets a
 * real discount figure instead of a quietly reduced fee.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('xray_receipts', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('hospital_id');
            // Per-hospital counter, as ultrasound_exams does, so two hospitals
            // do not share one run of receipt numbers.
            $table->unsignedInteger('sequence_id');
            $table->unsignedBigInteger('patient_id');
            $table->unsignedBigInteger('doctor_id')->nullable();
            // Free text: the study performed ("Chest PA", "Left Wrist AP/LAT").
            $table->string('study_name', 191);
            $table->dateTime('performed_at');
            $table->string('referred_by', 191)->nullable();
            $table->text('notes')->nullable();

            $table->decimal('fee', 12, 2)->default(0);
            $table->boolean('discount_enabled')->default(false);
            $table->decimal('discount_percentage', 5, 2)->default(0);
            $table->decimal('discount_amount', 12, 2)->default(0);
            $table->decimal('net_amount', 12, 2)->default(0);

            $table->string('payment_status', 20)->default('unpaid');
            $table->decimal('paid_amount', 12, 2)->default(0);
            $table->string('payment_method', 50)->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('paid_by')->nullable();
            $table->string('receipt_number')->nullable();

            $table->string('created_by', 191)->nullable();
            $table->string('updated_by', 191)->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->foreign('hospital_id')->references('id')->on('hospitals')->onDelete('cascade');
            $table->foreign('patient_id')->references('id')->on('patients')->onDelete('cascade');
            // Doctors are users; the `doctors` table is only a synced mirror.
            $table->foreign('doctor_id')->references('id')->on('users')->onDelete('set null');
            $table->unique(['hospital_id', 'sequence_id']);
            $table->index(['hospital_id', 'performed_at']);
            $table->index(['hospital_id', 'payment_status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('xray_receipts');
    }
};
