<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            if (!Schema::hasColumn('roles', 'hospital_id')) {
                $table->foreignId('hospital_id')->nullable()->after('id')->constrained()->cascadeOnDelete();
            }

            // Replace global uniqueness with hospital-scoped uniqueness.
            if (Schema::hasColumn('roles', 'name')) {
                try {
                    $table->dropUnique('roles_name_unique');
                } catch (Throwable $e) {
                    // ignore if index doesn't exist
                }

                $table->unique(['hospital_id', 'name']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('roles', function (Blueprint $table) {
            try {
                $table->dropUnique('roles_hospital_id_name_unique');
            } catch (Throwable $e) {
                // ignore
            }

            $table->unique('name');

            if (Schema::hasColumn('roles', 'hospital_id')) {
                $table->dropConstrainedForeignId('hospital_id');
            }
        });
    }
};
