<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Give each hospital a timezone and a calendar system.
 *
 * The Settings screen has offered both for some time but had nowhere to put
 * them -- saving raised "not yet wired to backend" -- so every date in the
 * application fell back to a default. That matters beyond formatting: forms
 * default their dates from the hospital's clock, and a workstation set to the
 * wrong timezone would otherwise book a patient on the wrong day.
 *
 * They live on `hospitals` rather than `hospital_settings` because the client
 * already reads `hospital.timezone` in dozens of places; putting them here
 * makes those call sites correct without touching one of them.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hospitals', function (Blueprint $table) {
            if (!Schema::hasColumn('hospitals', 'timezone')) {
                $table->string('timezone', 64)->default('Asia/Kabul')->after('brand_color');
            }
            if (!Schema::hasColumn('hospitals', 'calendar_type')) {
                $table->string('calendar_type', 20)->default('gregorian')->after('timezone');
            }
        });
    }

    public function down(): void
    {
        Schema::table('hospitals', function (Blueprint $table) {
            foreach (['timezone', 'calendar_type'] as $column) {
                if (Schema::hasColumn('hospitals', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
