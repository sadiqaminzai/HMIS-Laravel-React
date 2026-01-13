<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1) Copy doctor profile fields into users (based on legacy users.doctor_id -> doctors.id)
        // This allows us to migrate references from doctors to users safely.
        if (Schema::hasTable('doctors') && Schema::hasColumn('users', 'doctor_id')) {
            DB::statement("UPDATE users u\n                JOIN doctors d ON u.doctor_id = d.id\n                SET\n                    u.is_doctor = 1,\n                    u.phone = COALESCE(u.phone, d.phone),\n                    u.specialization = COALESCE(u.specialization, d.specialization),\n                    u.registration_number = COALESCE(u.registration_number, d.registration_number),\n                    u.consultation_fee = COALESCE(u.consultation_fee, d.consultation_fee),\n                    u.doctor_status = COALESCE(u.doctor_status, d.status),\n                    u.availability_schedule = COALESCE(u.availability_schedule, d.availability_schedule),\n                    u.image_path = COALESCE(u.image_path, d.image_path),\n                    u.signature_path = COALESCE(u.signature_path, d.signature_path)");
        }

        // Also mark any role=doctor users as is_doctor.
        DB::table('users')->where('role', 'doctor')->update(['is_doctor' => 1]);

        // 2) Rewrite foreign key values: doctor_id columns currently point to doctors.id.
        // Convert them to point to users.id by joining through users.doctor_id.
        if (Schema::hasColumn('users', 'doctor_id')) {
            foreach (['appointments', 'prescriptions', 'lab_orders'] as $table) {
                if (Schema::hasTable($table) && Schema::hasColumn($table, 'doctor_id')) {
                    DB::statement("UPDATE {$table} t\n                        JOIN users u ON u.doctor_id = t.doctor_id\n                        SET t.doctor_id = u.id");
                }
            }

            if (Schema::hasTable('hospital_settings') && Schema::hasColumn('hospital_settings', 'default_doctor_id')) {
                DB::statement("UPDATE hospital_settings hs\n                    JOIN users u ON u.doctor_id = hs.default_doctor_id\n                    SET hs.default_doctor_id = u.id");
            }

            // Keep doctor_name snapshots consistent where present.
            if (Schema::hasTable('prescriptions') && Schema::hasColumn('prescriptions', 'doctor_name')) {
                DB::statement("UPDATE prescriptions p\n                    JOIN users u ON u.id = p.doctor_id\n                    SET p.doctor_name = u.name");
            }

            if (Schema::hasTable('lab_orders') && Schema::hasColumn('lab_orders', 'doctor_name')) {
                DB::statement("UPDATE lab_orders o\n                    JOIN users u ON u.id = o.doctor_id\n                    SET o.doctor_name = u.name");
            }
        }

        // 3) Re-point constraints to users table.
        if (Schema::hasTable('appointments') && Schema::hasColumn('appointments', 'doctor_id')) {
            Schema::table('appointments', function (Blueprint $table) {
                // drop old FK to doctors
                $table->dropForeign(['doctor_id']);
            });

            Schema::table('appointments', function (Blueprint $table) {
                $table->foreign('doctor_id')->references('id')->on('users')->cascadeOnDelete();
            });
        }

        if (Schema::hasTable('prescriptions') && Schema::hasColumn('prescriptions', 'doctor_id')) {
            Schema::table('prescriptions', function (Blueprint $table) {
                $table->dropForeign(['doctor_id']);
            });

            Schema::table('prescriptions', function (Blueprint $table) {
                $table->foreign('doctor_id')->references('id')->on('users')->cascadeOnDelete();
            });
        }

        if (Schema::hasTable('lab_orders') && Schema::hasColumn('lab_orders', 'doctor_id')) {
            Schema::table('lab_orders', function (Blueprint $table) {
                $table->dropForeign(['doctor_id']);
            });

            Schema::table('lab_orders', function (Blueprint $table) {
                $table->foreign('doctor_id')->references('id')->on('users')->cascadeOnDelete();
            });
        }

        if (Schema::hasTable('hospital_settings') && Schema::hasColumn('hospital_settings', 'default_doctor_id')) {
            Schema::table('hospital_settings', function (Blueprint $table) {
                $table->dropForeign(['default_doctor_id']);
            });

            Schema::table('hospital_settings', function (Blueprint $table) {
                $table->foreign('default_doctor_id')->references('id')->on('users')->nullOnDelete();
            });
        }

        // 4) Remove legacy users.doctor_id and the doctors table.
        if (Schema::hasColumn('users', 'doctor_id')) {
            Schema::table('users', function (Blueprint $table) {
                // users.doctor_id previously referenced doctors
                $table->dropConstrainedForeignId('doctor_id');
            });
        }

        if (Schema::hasTable('doctors')) {
            Schema::drop('doctors');
        }
    }

    public function down(): void
    {
        // This migration is destructive (drops doctors table) and cannot be safely reversed automatically.
        // If needed, restore from backup.
    }
};
