<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Default walk-in customer details, configured once per hospital.
 *
 * A retail pharmacy sells to an anonymous counter customer all day; making the
 * cashier retype the same name on every invoice is pure friction. These values
 * pre-fill the walk-in fields on a new sale and stay editable per invoice.
 *
 * All nullable: leaving them blank keeps the current behaviour (empty fields).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('hospital_settings', 'pharmacy_walk_in_default_name')) {
                $table->string('pharmacy_walk_in_default_name', 191)
                    ->nullable()
                    ->after('pharmacy_default_customer');
            }
            if (!Schema::hasColumn('hospital_settings', 'pharmacy_walk_in_default_phone')) {
                $table->string('pharmacy_walk_in_default_phone', 50)
                    ->nullable()
                    ->after('pharmacy_walk_in_default_name');
            }
            if (!Schema::hasColumn('hospital_settings', 'pharmacy_walk_in_default_address')) {
                $table->string('pharmacy_walk_in_default_address', 255)
                    ->nullable()
                    ->after('pharmacy_walk_in_default_phone');
            }
        });
    }

    public function down(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            foreach ([
                'pharmacy_walk_in_default_address',
                'pharmacy_walk_in_default_phone',
                'pharmacy_walk_in_default_name',
            ] as $column) {
                if (Schema::hasColumn('hospital_settings', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
