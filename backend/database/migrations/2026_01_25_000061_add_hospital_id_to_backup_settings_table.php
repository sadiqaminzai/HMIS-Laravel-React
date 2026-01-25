<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('backup_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('backup_settings', 'hospital_id')) {
                $table->foreignId('hospital_id')->nullable()->after('id')->constrained('hospitals')->nullOnDelete();
                $table->unique('hospital_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('backup_settings', function (Blueprint $table) {
            if (Schema::hasColumn('backup_settings', 'hospital_id')) {
                $table->dropUnique(['hospital_id']);
                $table->dropConstrainedForeignId('hospital_id');
            }
        });
    }
};
