<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('prescriptions', function (Blueprint $table) {
            $table->date('next_visit_date')->nullable()->after('advice');
            $table->index(['hospital_id', 'next_visit_date']);
        });
    }

    public function down(): void
    {
        Schema::table('prescriptions', function (Blueprint $table) {
            $table->dropIndex(['hospital_id', 'next_visit_date']);
            $table->dropColumn('next_visit_date');
        });
    }
};
