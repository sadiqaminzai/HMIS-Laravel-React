<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who created and last changed a medicine.
 *
 * The Medicine Details view shows these alongside the timestamps, and they
 * follow the same convention already used by transactions (a plain name string
 * rather than a foreign key, so the record survives user deletion).
 *
 * Nullable: rows that predate this migration simply have no attribution.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            if (!Schema::hasColumn('medicines', 'created_by')) {
                $table->string('created_by')->nullable()->after('status');
            }
            if (!Schema::hasColumn('medicines', 'updated_by')) {
                $table->string('updated_by')->nullable()->after('created_by');
            }
        });
    }

    public function down(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            foreach (['updated_by', 'created_by'] as $column) {
                if (Schema::hasColumn('medicines', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
