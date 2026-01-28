<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('prescriptions', function (Blueprint $table) {
            $table->uuid('verification_token')->nullable()->unique()->after('status');
        });

        Schema::table('patients', function (Blueprint $table) {
            $table->uuid('verification_token')->nullable()->unique()->after('status');
        });

        Schema::table('lab_orders', function (Blueprint $table) {
            $table->uuid('verification_token')->nullable()->unique()->after('status');
        });

        DB::table('prescriptions')
            ->whereNull('verification_token')
            ->orderBy('id')
            ->chunkById(200, function ($rows) {
                foreach ($rows as $row) {
                    DB::table('prescriptions')->where('id', $row->id)->update([
                        'verification_token' => (string) Str::uuid(),
                    ]);
                }
            });

        DB::table('patients')
            ->whereNull('verification_token')
            ->orderBy('id')
            ->chunkById(200, function ($rows) {
                foreach ($rows as $row) {
                    DB::table('patients')->where('id', $row->id)->update([
                        'verification_token' => (string) Str::uuid(),
                    ]);
                }
            });

        DB::table('lab_orders')
            ->whereNull('verification_token')
            ->orderBy('id')
            ->chunkById(200, function ($rows) {
                foreach ($rows as $row) {
                    DB::table('lab_orders')->where('id', $row->id)->update([
                        'verification_token' => (string) Str::uuid(),
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('prescriptions', function (Blueprint $table) {
            $table->dropUnique(['verification_token']);
            $table->dropColumn('verification_token');
        });

        Schema::table('patients', function (Blueprint $table) {
            $table->dropUnique(['verification_token']);
            $table->dropColumn('verification_token');
        });

        Schema::table('lab_orders', function (Blueprint $table) {
            $table->dropUnique(['verification_token']);
            $table->dropColumn('verification_token');
        });
    }
};
