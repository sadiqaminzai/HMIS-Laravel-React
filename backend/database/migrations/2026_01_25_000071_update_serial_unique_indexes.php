<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropUnique('appointments_appointment_number_unique');
            $table->unique(['hospital_id', 'appointment_number']);
        });

        Schema::table('prescriptions', function (Blueprint $table) {
            $table->dropUnique('prescriptions_prescription_number_unique');
            $table->unique(['hospital_id', 'prescription_number']);
        });

        Schema::table('lab_orders', function (Blueprint $table) {
            $table->dropUnique('lab_orders_order_number_unique');
            $table->unique(['hospital_id', 'order_number']);
        });
    }

    public function down(): void
    {
        Schema::table('lab_orders', function (Blueprint $table) {
            $table->dropUnique(['hospital_id', 'order_number']);
            $table->unique('order_number');
        });

        Schema::table('prescriptions', function (Blueprint $table) {
            $table->dropUnique(['hospital_id', 'prescription_number']);
            $table->unique('prescription_number');
        });

        Schema::table('appointments', function (Blueprint $table) {
            $table->dropUnique(['hospital_id', 'appointment_number']);
            $table->unique('appointment_number');
        });
    }
};
