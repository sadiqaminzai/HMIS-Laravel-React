<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'created_by')) {
                $table->string('created_by', 191)->nullable()->after('last_login_at');
            }

            if (!Schema::hasColumn('users', 'updated_by')) {
                $table->string('updated_by', 191)->nullable()->after('created_by');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'updated_by')) {
                $table->dropColumn('updated_by');
            }

            if (Schema::hasColumn('users', 'created_by')) {
                $table->dropColumn('created_by');
            }
        });
    }
};
