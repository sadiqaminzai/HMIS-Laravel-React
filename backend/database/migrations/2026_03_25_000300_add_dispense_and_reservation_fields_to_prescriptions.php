<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('prescriptions', function (Blueprint $table) {
            $table->timestamp('dispensed_at')->nullable()->after('status');
            $table->string('dispensed_by')->nullable()->after('dispensed_at');
            $table->foreignId('dispensing_transaction_id')
                ->nullable()
                ->after('dispensed_by')
                ->constrained('transactions')
                ->nullOnDelete();
        });

        Schema::table('prescription_items', function (Blueprint $table) {
            $table->unsignedInteger('reserved_quantity')->default(0)->after('quantity');
            $table->unsignedInteger('dispensed_quantity')->default(0)->after('reserved_quantity');
            $table->timestamp('dispensed_at')->nullable()->after('dispensed_quantity');
            $table->index(['medicine_id', 'reserved_quantity', 'dispensed_quantity'], 'pi_medicine_reserve_dispense_idx');
        });
    }

    public function down(): void
    {
        Schema::table('prescription_items', function (Blueprint $table) {
            $table->dropIndex('pi_medicine_reserve_dispense_idx');
            $table->dropColumn(['reserved_quantity', 'dispensed_quantity', 'dispensed_at']);
        });

        Schema::table('prescriptions', function (Blueprint $table) {
            $table->dropConstrainedForeignId('dispensing_transaction_id');
            $table->dropColumn(['dispensed_at', 'dispensed_by']);
        });
    }
};
