<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            if (!Schema::hasColumn('transactions', 'supplier_name')) {
                $table->string('supplier_name')->nullable()->after('supplier_id');
            }
            if (!Schema::hasColumn('transactions', 'patient_name')) {
                $table->string('patient_name')->nullable()->after('patient_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            if (Schema::hasColumn('transactions', 'patient_name')) {
                $table->dropColumn('patient_name');
            }
            if (Schema::hasColumn('transactions', 'supplier_name')) {
                $table->dropColumn('supplier_name');
            }
        });
    }
};
