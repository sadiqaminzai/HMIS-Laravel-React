<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            $table->string('barcode')->nullable()->after('strength');
            $table->index(['hospital_id', 'barcode']);
        });
    }

    public function down(): void
    {
        Schema::table('medicines', function (Blueprint $table) {
            $table->dropIndex(['hospital_id', 'barcode']);
            $table->dropColumn('barcode');
        });
    }
};
