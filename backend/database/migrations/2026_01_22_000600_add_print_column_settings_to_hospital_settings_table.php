<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            $table->boolean('print_show_batch_column')->default(true)->after('patient_id_digits');
            $table->boolean('print_show_expiry_date_column')->default(true)->after('print_show_batch_column');
            $table->boolean('print_show_bonus_column')->default(true)->after('print_show_expiry_date_column');
        });
    }

    public function down(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            $table->dropColumn([
                'print_show_batch_column',
                'print_show_expiry_date_column',
                'print_show_bonus_column',
            ]);
        });
    }
};
