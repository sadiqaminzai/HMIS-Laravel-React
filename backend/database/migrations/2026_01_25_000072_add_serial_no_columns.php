<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('doctors', function (Blueprint $table) {
            $table->unsignedBigInteger('serial_no')->nullable()->after('hospital_id');
            $table->unique(['hospital_id', 'serial_no']);
        });

        Schema::table('manufacturers', function (Blueprint $table) {
            $table->unsignedBigInteger('serial_no')->nullable()->after('hospital_id');
            $table->unique(['hospital_id', 'serial_no']);
        });

        Schema::table('medicine_types', function (Blueprint $table) {
            $table->unsignedBigInteger('serial_no')->nullable()->after('hospital_id');
            $table->unique(['hospital_id', 'serial_no']);
        });

        Schema::table('medicines', function (Blueprint $table) {
            $table->unsignedBigInteger('serial_no')->nullable()->after('hospital_id');
            $table->unique(['hospital_id', 'serial_no']);
        });

        Schema::table('stocks', function (Blueprint $table) {
            $table->unsignedBigInteger('serial_no')->nullable()->after('hospital_id');
            $table->unique(['hospital_id', 'serial_no']);
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->unsignedBigInteger('serial_no')->nullable()->after('hospital_id');
            $table->unique(['hospital_id', 'serial_no']);
        });

        Schema::table('stock_reconciliations', function (Blueprint $table) {
            $table->unsignedBigInteger('serial_no')->nullable()->after('hospital_id');
            $table->unique(['hospital_id', 'serial_no']);
        });

        Schema::table('suppliers', function (Blueprint $table) {
            $table->unsignedBigInteger('serial_no')->nullable()->after('hospital_id');
            $table->unique(['hospital_id', 'serial_no']);
        });

        Schema::table('roles', function (Blueprint $table) {
            $table->unsignedBigInteger('serial_no')->nullable()->after('hospital_id');
            $table->unique(['hospital_id', 'serial_no']);
        });

        Schema::table('users', function (Blueprint $table) {
            $table->unsignedBigInteger('serial_no')->nullable()->after('hospital_id');
            $table->unique(['hospital_id', 'serial_no']);
        });

        Schema::table('walk_in_patients', function (Blueprint $table) {
            $table->unsignedBigInteger('serial_no')->nullable()->after('hospital_id');
            $table->unique(['hospital_id', 'serial_no']);
        });

        Schema::table('hospital_settings', function (Blueprint $table) {
            $table->unsignedBigInteger('serial_no')->nullable()->after('hospital_id');
            $table->unique(['hospital_id', 'serial_no']);
        });

        Schema::table('backup_settings', function (Blueprint $table) {
            $table->unsignedBigInteger('serial_no')->nullable()->after('hospital_id');
            $table->unique(['hospital_id', 'serial_no']);
        });

        Schema::table('contact_messages', function (Blueprint $table) {
            $table->unsignedBigInteger('serial_no')->nullable()->after('hospital_id');
            $table->unique(['hospital_id', 'serial_no']);
        });

        Schema::table('transactions', function (Blueprint $table) {
            $table->unsignedBigInteger('serial_no')->nullable()->after('hospital_id');
            $table->unique(['hospital_id', 'serial_no']);
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropUnique(['hospital_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });

        Schema::table('contact_messages', function (Blueprint $table) {
            $table->dropUnique(['hospital_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });

        Schema::table('backup_settings', function (Blueprint $table) {
            $table->dropUnique(['hospital_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });

        Schema::table('hospital_settings', function (Blueprint $table) {
            $table->dropUnique(['hospital_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });

        Schema::table('walk_in_patients', function (Blueprint $table) {
            $table->dropUnique(['hospital_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['hospital_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });

        Schema::table('roles', function (Blueprint $table) {
            $table->dropUnique(['hospital_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });

        Schema::table('suppliers', function (Blueprint $table) {
            $table->dropUnique(['hospital_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });

        Schema::table('stock_reconciliations', function (Blueprint $table) {
            $table->dropUnique(['hospital_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });

        Schema::table('stock_movements', function (Blueprint $table) {
            $table->dropUnique(['hospital_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });

        Schema::table('stocks', function (Blueprint $table) {
            $table->dropUnique(['hospital_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });

        Schema::table('medicines', function (Blueprint $table) {
            $table->dropUnique(['hospital_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });

        Schema::table('medicine_types', function (Blueprint $table) {
            $table->dropUnique(['hospital_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });

        Schema::table('manufacturers', function (Blueprint $table) {
            $table->dropUnique(['hospital_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });

        Schema::table('doctors', function (Blueprint $table) {
            $table->dropUnique(['hospital_id', 'serial_no']);
            $table->dropColumn('serial_no');
        });
    }
};
