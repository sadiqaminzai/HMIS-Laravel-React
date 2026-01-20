<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            if (!Schema::hasColumn('transactions', 'supplier_id')) {
                $table->foreignId('supplier_id')->nullable()->constrained('suppliers')->nullOnDelete()->after('hospital_id');
            }
            if (!Schema::hasColumn('transactions', 'patient_id')) {
                $table->foreignId('patient_id')->nullable()->constrained('patients')->nullOnDelete()->after('supplier_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            if (Schema::hasColumn('transactions', 'patient_id')) {
                $table->dropConstrainedForeignId('patient_id');
            }
            if (Schema::hasColumn('transactions', 'supplier_id')) {
                $table->dropConstrainedForeignId('supplier_id');
            }
        });
    }
};
