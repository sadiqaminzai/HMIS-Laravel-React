<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Room bookings join the standing-discount family.
 *
 * Added separately from the first five because room bookings were not part of
 * that request; the column, the validation and the settings field all behave
 * identically to the others.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('hospital_settings')
            || Schema::hasColumn('hospital_settings', 'default_discount_room_booking')) {
            return;
        }

        Schema::table('hospital_settings', function (Blueprint $table) {
            $table->decimal('default_discount_room_booking', 5, 2)
                ->default(0)
                ->after('default_discount_dental');
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('hospital_settings')
            && Schema::hasColumn('hospital_settings', 'default_discount_room_booking')) {
            Schema::table('hospital_settings', fn (Blueprint $t) => $t->dropColumn('default_discount_room_booking'));
        }
    }
};
