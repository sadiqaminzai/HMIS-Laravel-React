<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('patient_surgeries', function (Blueprint $table) {
            // Add all missing columns (notes was already handled in the previous migration)
            if (!Schema::hasColumn('patient_surgeries', 'created_by')) {
                $table->foreignId('created_by')->nullable()->after('cost')
                    ->constrained('users')->nullOnDelete();
            }
            
            if (!Schema::hasColumn('patient_surgeries', 'updated_by')) {
                $table->foreignId('updated_by')->nullable()->after('created_by')
                    ->constrained('users')->nullOnDelete();
            }
            
            if (!Schema::hasColumn('patient_surgeries', 'deleted_by')) {
                $table->foreignId('deleted_by')->nullable()->after('updated_by')
                    ->constrained('users')->nullOnDelete();
            }
            
            if (!Schema::hasColumn('patient_surgeries', 'is_active')) {
                $table->boolean('is_active')->default(1)->after('deleted_by');
            }
            
            if (!Schema::hasColumn('patient_surgeries', 'is_delete')) {
                $table->boolean('is_delete')->default(0)->after('is_active');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('patient_surgeries', function (Blueprint $table) {
            // Drop columns in reverse order
            if (Schema::hasColumn('patient_surgeries', 'is_delete')) {
                $table->dropColumn('is_delete');
            }
            
            if (Schema::hasColumn('patient_surgeries', 'is_active')) {
                $table->dropColumn('is_active');
            }
            
            if (Schema::hasColumn('patient_surgeries', 'deleted_by')) {
                $table->dropForeign(['deleted_by']);
                $table->dropColumn('deleted_by');
            }
            
            if (Schema::hasColumn('patient_surgeries', 'updated_by')) {
                $table->dropForeign(['updated_by']);
                $table->dropColumn('updated_by');
            }
            
            if (Schema::hasColumn('patient_surgeries', 'created_by')) {
                $table->dropForeign(['created_by']);
                $table->dropColumn('created_by');
            }
        });
    }
};