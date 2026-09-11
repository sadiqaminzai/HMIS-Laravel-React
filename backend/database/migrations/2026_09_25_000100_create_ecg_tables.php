<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ECG: a study catalogue and the receipts raised against it.
 *
 * The same pair as Dental and X-Ray, because an ECG here is a cash desk: the
 * trace itself is printed by the machine and filed in the patient's chart, so
 * what ShifaaScript needs to hold is which study was run and what was charged
 * for it.
 *
 * ecg_services is deliberately empty on install -- resting ECG, stress ECG,
 * Holter and the rest are priced differently by every hospital, so the list is
 * built through the CRUD screen and no hospital inherits another's prices.
 *
 * The discount columns match Dental, X-Ray and surgery, so a campaign is
 * recorded the same way everywhere and the ledger receives a real gross,
 * discount and net rather than a quietly reduced fee.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('ecg_services')) {
            Schema::create('ecg_services', function (Blueprint $table) {
                $table->id();
                $table->foreignId('hospital_id')->constrained('hospitals')->cascadeOnDelete();
                // English name; the description carries the hospital's own
                // wording and any per-variant pricing note it wants printed.
                $table->string('name', 191);
                $table->string('code', 50)->nullable();
                $table->text('description')->nullable();
                $table->decimal('price', 12, 2)->default(0);
                $table->integer('sort_order')->default(0);
                $table->boolean('is_active')->default(true);
                $table->string('created_by', 191)->nullable();
                $table->string('updated_by', 191)->nullable();
                $table->timestamps();
                $table->softDeletes();

                $table->index(['hospital_id', 'is_active', 'sort_order'], 'ecg_services_listing_index');
            });
        }

        if (!Schema::hasTable('ecg_receipts')) {
            Schema::create('ecg_receipts', function (Blueprint $table) {
                $table->id();
                $table->unsignedBigInteger('hospital_id');
                // Per-hospital counter, so two hospitals do not share one run
                // of receipt numbers.
                $table->unsignedInteger('sequence_id');
                $table->unsignedBigInteger('patient_id');
                $table->unsignedBigInteger('doctor_id')->nullable();
                // nullOnDelete: retiring a study must never delete the money
                // already taken for it.
                $table->foreignId('ecg_service_id')->nullable()->constrained('ecg_services')->nullOnDelete();
                // Copied from the service at the time of billing, so renaming
                // a study later cannot rewrite receipts already printed.
                $table->string('service_name', 191);
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
    }

    public function down(): void
    {
        Schema::dropIfExists('ecg_receipts');
        Schema::dropIfExists('ecg_services');
    }
};
