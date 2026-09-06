<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Whether the prescribing doctor's phone number prints on the letterhead.
 *
 * Some doctors want patients able to reach them directly; others deliberately
 * keep the clinic's number as the only route in. Both are reasonable, so it is
 * a per-hospital switch rather than a decision baked into the template.
 *
 * Defaults to false: a personal number appearing on printed paper is not
 * something an upgrade should start doing on its own.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('hospital_settings')
            || Schema::hasColumn('hospital_settings', 'show_doctor_phone_on_prescription')) {
            return;
        }

        Schema::table('hospital_settings', function (Blueprint $table) {
            $table->boolean('show_doctor_phone_on_prescription')->default(false);
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('hospital_settings')
            && Schema::hasColumn('hospital_settings', 'show_doctor_phone_on_prescription')) {
            Schema::table('hospital_settings', function (Blueprint $table) {
                $table->dropColumn('show_doctor_phone_on_prescription');
            });
        }
    }
};
