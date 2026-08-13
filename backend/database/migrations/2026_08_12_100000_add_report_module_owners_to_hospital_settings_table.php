<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Which reporting desk owns each income module, per hospital.
 *
 * Stored as JSON keyed by ledger module so a hospital can hand pharmacy sales
 * to the pharmacist while reception keeps appointments, lab, radiology, surgery
 * and room bookings -- or any other split.
 *
 * Nullable: a hospital with no stored value falls back to
 * config/report_ownership.php, so existing hospitals keep working untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('hospital_settings', 'report_module_owners')) {
                $table->json('report_module_owners')->nullable()->after('invoice_fields');
            }
        });
    }

    public function down(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            if (Schema::hasColumn('hospital_settings', 'report_module_owners')) {
                $table->dropColumn('report_module_owners');
            }
        });
    }
};
