<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('patient_surgeries', function (Blueprint $table) {
            $table->uuid('verification_token')->nullable()->unique()->after('notes');
        });

        DB::table('patient_surgeries')
            ->whereNull('verification_token')
            ->chunkById(200, function ($rows) {
                foreach ($rows as $row) {
                    DB::table('patient_surgeries')
                        ->where('id', $row->id)
                        ->update([
                            'verification_token' => (string) Str::uuid(),
                            'updated_at' => now(),
                        ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('patient_surgeries', function (Blueprint $table) {
            $table->dropUnique(['verification_token']);
            $table->dropColumn('verification_token');
        });
    }
};
