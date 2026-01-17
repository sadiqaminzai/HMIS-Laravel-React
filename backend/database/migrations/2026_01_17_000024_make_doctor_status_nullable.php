<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasColumn('users', 'doctor_status')) {
            return;
        }

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE `users` MODIFY `doctor_status` ENUM('active','inactive') NULL DEFAULT 'active'");
        }
    }

    public function down(): void
    {
        if (!Schema::hasColumn('users', 'doctor_status')) {
            return;
        }

        if (DB::getDriverName() === 'mysql') {
            DB::statement("ALTER TABLE `users` MODIFY `doctor_status` ENUM('active','inactive') NOT NULL DEFAULT 'active'");
        }
    }
};
