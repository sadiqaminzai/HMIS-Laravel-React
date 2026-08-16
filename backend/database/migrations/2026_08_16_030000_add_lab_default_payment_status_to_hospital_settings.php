<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Whether a new lab order starts already settled.
 *
 * Hospitals differ: where the fee is collected at the counter before the order
 * is entered, every order starting Unpaid means a second click on every single
 * one. Where the lab bills afterwards, starting Paid would be wrong. Defaults
 * to unpaid, which is the safe reading -- money is only recorded once someone
 * says it was taken.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            $table->string('lab_default_payment_status', 10)
                ->default('unpaid')
                ->after('show_prescription_list_meta');
        });
    }

    public function down(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            $table->dropColumn('lab_default_payment_status');
        });
    }
};
