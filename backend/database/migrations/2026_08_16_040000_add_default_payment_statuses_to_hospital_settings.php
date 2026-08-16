<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which payment status a new pharmacy document starts on, per type.
 *
 * A counter that takes cash before handing over medicine wants every sale to
 * start Paid; one that invoices suppliers monthly wants purchases to start
 * Pending. Stored per trx_type because the answer genuinely differs between
 * them -- a sale and a purchase are opposite sides of the same counter.
 *
 * Null means "unset", which is read as pending: money is only ever recorded as
 * received once someone says so.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            $table->json('default_payment_statuses')
                ->nullable()
                ->after('lab_default_payment_status');
        });
    }

    public function down(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            $table->dropColumn('default_payment_statuses');
        });
    }
};
