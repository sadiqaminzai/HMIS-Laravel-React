<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            if (Schema::hasColumn('patients', 'referred_doctor_id')) {
                // FK name is typically patients_referred_doctor_id_foreign
                try {
                    $table->dropForeign(['referred_doctor_id']);
                } catch (\Throwable $e) {
                    // Ignore if FK is missing or has a different name.
                }
                $table->dropColumn('referred_doctor_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('patients', function (Blueprint $table) {
            if (!Schema::hasColumn('patients', 'referred_doctor_id')) {
                $table->foreignId('referred_doctor_id')
                    ->nullable()
                    ->after('address')
                    ->constrained('doctors')
                    ->nullOnDelete();
            }
        });
    }
};
