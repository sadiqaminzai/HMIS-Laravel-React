<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * 2D codes (QR / DataMatrix) on pharmaceutical packs commonly encode a URL or a
 * GS1 element string, which are far longer than the 64 characters a 1D barcode
 * needs -- e.g. https://qr.genixpharma.com/g/3Ty7srFXstI.
 *
 * Widened to 191 so it still fits inside the composite unique index under
 * MySQL's utf8mb4 index-length limit.
 */
return new class extends Migration
{
    public function up(): void
    {
        // The unique index has to be dropped before the column can be resized.
        Schema::table('medicines', function (Blueprint $table) {
            $table->dropUnique('medicines_hospital_barcode_unique');
        });

        DB::statement('ALTER TABLE `medicines` MODIFY `barcode` VARCHAR(191) NULL');

        Schema::table('medicines', function (Blueprint $table) {
            $table->unique(['hospital_id', 'barcode'], 'medicines_hospital_barcode_unique');
        });
    }

    public function down(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            $table->dropUnique('medicines_hospital_barcode_unique');
        });

        DB::statement('ALTER TABLE `medicines` MODIFY `barcode` VARCHAR(64) NULL');

        Schema::table('medicines', function (Blueprint $table) {
            $table->unique(['hospital_id', 'barcode'], 'medicines_hospital_barcode_unique');
        });
    }
};
