<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Convert enum role column to string so tenant roles can be created dynamically.
        // This uses raw SQL to avoid requiring doctrine/dbal.
        try {
            DB::statement("ALTER TABLE `users` MODIFY `role` VARCHAR(64) NOT NULL");
        } catch (Throwable $e) {
            // ignore if already altered
        }

        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'role_id')) {
                $table->foreignId('role_id')->nullable()->after('role')->constrained('roles')->nullOnDelete();
                $table->index(['hospital_id', 'role_id']);
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'role_id')) {
                $table->dropIndex(['hospital_id', 'role_id']);
                $table->dropConstrainedForeignId('role_id');
            }
        });

        // Best-effort revert; may fail if enum values changed.
        try {
            DB::statement("ALTER TABLE `users` MODIFY `role` ENUM('super_admin','admin','doctor','receptionist','pharmacist','lab_technician') NOT NULL");
        } catch (Throwable $e) {
            // ignore
        }
    }
};
