<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('patient_surgeries', function (Blueprint $table) {
            // Add notes column if it doesn't exist
            if (!Schema::hasColumn('patient_surgeries', 'notes')) {
                $table->text('notes')->nullable()->after('status');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('patient_surgeries', function (Blueprint $table) {
            if (Schema::hasColumn('patient_surgeries', 'notes')) {
                $table->dropColumn('notes');
            }
        });
    }
};