<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            // Defaults reproduce the watermark every hospital already prints,
            // so an existing clinic sees no change until it chooses one.
            $table->boolean('prescription_watermark_enabled')
                ->default(true)
                ->after('prescription_signature_height');

            // 'stethoscope' = the bundled mark, 'logo' = the hospital's own
            // logo, 'custom' = an image uploaded for this purpose.
            $table->string('prescription_watermark_source', 20)
                ->default('stethoscope')
                ->after('prescription_watermark_enabled');

            $table->string('prescription_watermark_path')
                ->nullable()
                ->after('prescription_watermark_source');

            $table->unsignedInteger('prescription_watermark_width')
                ->default(440)
                ->after('prescription_watermark_path');
        });
    }

    public function down(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            $table->dropColumn([
                'prescription_watermark_enabled',
                'prescription_watermark_source',
                'prescription_watermark_path',
                'prescription_watermark_width',
            ]);
        });
    }
};
