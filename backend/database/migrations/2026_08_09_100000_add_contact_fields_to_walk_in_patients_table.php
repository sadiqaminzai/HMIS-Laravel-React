<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Retail pharmacy sales capture a walk-in customer's phone (and sometimes an
 * address) for receipts and follow-up. The existing walk_in_patients table only
 * held name/age/gender because lab orders and prescriptions never needed more.
 *
 * Both columns are nullable: a walk-in sale must remain possible with nothing
 * more than a name, and existing walk-in records stay valid untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('walk_in_patients', function (Blueprint $table) {
            if (!Schema::hasColumn('walk_in_patients', 'phone')) {
                $table->string('phone', 30)->nullable()->after('gender');
            }
            if (!Schema::hasColumn('walk_in_patients', 'address')) {
                $table->string('address')->nullable()->after('phone');
            }
        });
    }

    public function down(): void
    {
        Schema::table('walk_in_patients', function (Blueprint $table) {
            if (Schema::hasColumn('walk_in_patients', 'address')) {
                $table->dropColumn('address');
            }
            if (Schema::hasColumn('walk_in_patients', 'phone')) {
                $table->dropColumn('phone');
            }
        });
    }
};
