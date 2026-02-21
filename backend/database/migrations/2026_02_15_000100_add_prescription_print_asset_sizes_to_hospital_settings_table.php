<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            $table->unsignedInteger('prescription_logo_width')->default(176)->after('print_show_bonus_column');
            $table->unsignedInteger('prescription_logo_height')->default(160)->after('prescription_logo_width');
            $table->unsignedInteger('prescription_signature_width')->default(200)->after('prescription_logo_height');
            $table->unsignedInteger('prescription_signature_height')->default(112)->after('prescription_signature_width');
        });
    }

    public function down(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            $table->dropColumn([
                'prescription_logo_width',
                'prescription_logo_height',
                'prescription_signature_width',
                'prescription_signature_height',
            ]);
        });
    }
};
