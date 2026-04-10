<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->string('appointment_time', 20)->nullable()->change();
        });
    }

    public function down(): void
    {
        DB::table('appointments')
            ->whereNull('appointment_time')
            ->update(['appointment_time' => '']);

        Schema::table('appointments', function (Blueprint $table) {
            $table->string('appointment_time', 20)->nullable(false)->change();
        });
    }
};
