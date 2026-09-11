<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * ECG joins the standing-discount family.
 *
 * The ECG receipt screen seeds its discount field from this the way the dental
 * one does, so without the column the new desk would open every receipt at a
 * hardcoded zero while every other desk remembered the hospital's campaign.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('hospital_settings')
            || Schema::hasColumn('hospital_settings', 'default_discount_ecg')) {
            return;
        }

        Schema::table('hospital_settings', function (Blueprint $table) {
            $table->decimal('default_discount_ecg', 5, 2)
                ->default(0)
                ->after('default_discount_room_booking');
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('hospital_settings')
            && Schema::hasColumn('hospital_settings', 'default_discount_ecg')) {
            Schema::table('hospital_settings', fn (Blueprint $t) => $t->dropColumn('default_discount_ecg'));
        }
    }
};
