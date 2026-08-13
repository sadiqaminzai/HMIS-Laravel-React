<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Master switch for barcode/QR scanning in this hospital.
 *
 * When off, the barcode section disappears from the medicine form and the scan
 * field disappears from every invoice, so a pharmacy without a scanner is not
 * shown controls it cannot use. Stored barcodes are left untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('hospital_settings', 'barcode_scanning_enabled')) {
                $table->boolean('barcode_scanning_enabled')
                    ->default(true)
                    ->after('pharmacy_default_sale_unit');
            }
        });
    }

    public function down(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            if (Schema::hasColumn('hospital_settings', 'barcode_scanning_enabled')) {
                $table->dropColumn('barcode_scanning_enabled');
            }
        });
    }
};
