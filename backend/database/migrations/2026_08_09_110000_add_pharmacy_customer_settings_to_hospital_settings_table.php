<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-hospital configuration for who a pharmacy sale can be made to.
 *
 *   pharmacy_customer_mode
 *     patient_only  - hospital deployment: registered patients only
 *     walk_in_only  - retail pharmacy deployment: walk-in customers only
 *     both          - both options offered (default, matches current behaviour)
 *
 *   pharmacy_default_customer
 *     which option a new sale opens on when both are available.
 *
 * Defaults keep every existing hospital behaving exactly as it does today:
 * both options available, defaulting to the registered patient workflow.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('hospital_settings', 'pharmacy_customer_mode')) {
                $table->string('pharmacy_customer_mode', 20)
                    ->default('both')
                    ->after('print_paper_sizes');
            }
            if (!Schema::hasColumn('hospital_settings', 'pharmacy_default_customer')) {
                $table->string('pharmacy_default_customer', 20)
                    ->default('patient')
                    ->after('pharmacy_customer_mode');
            }
        });
    }

    public function down(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            foreach (['pharmacy_default_customer', 'pharmacy_customer_mode'] as $column) {
                if (Schema::hasColumn('hospital_settings', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
