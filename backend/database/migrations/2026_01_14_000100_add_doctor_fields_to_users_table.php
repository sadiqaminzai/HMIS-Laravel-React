<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'phone')) {
                $table->string('phone')->nullable()->after('email');
            }

            if (!Schema::hasColumn('users', 'is_doctor')) {
                $table->boolean('is_doctor')->default(false)->after('role');
            }

            if (!Schema::hasColumn('users', 'specialization')) {
                $table->string('specialization')->nullable()->after('is_doctor');
            }

            if (!Schema::hasColumn('users', 'registration_number')) {
                $table->string('registration_number')->nullable()->after('specialization');
            }

            if (!Schema::hasColumn('users', 'consultation_fee')) {
                $table->decimal('consultation_fee', 10, 2)->default(0)->after('registration_number');
            }

            if (!Schema::hasColumn('users', 'doctor_status')) {
                $table->enum('doctor_status', ['active', 'inactive'])->default('active')->after('consultation_fee');
            }

            if (!Schema::hasColumn('users', 'availability_schedule')) {
                $table->json('availability_schedule')->nullable()->after('doctor_status');
            }

            if (!Schema::hasColumn('users', 'image_path')) {
                $table->string('image_path')->nullable()->after('availability_schedule');
            }

            if (!Schema::hasColumn('users', 'signature_path')) {
                $table->string('signature_path')->nullable()->after('image_path');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            foreach (['signature_path', 'image_path', 'availability_schedule', 'doctor_status', 'consultation_fee', 'registration_number', 'specialization', 'is_doctor', 'phone'] as $col) {
                if (Schema::hasColumn('users', $col)) {
                    $table->dropColumn($col);
                }
            }
        });
    }
};
