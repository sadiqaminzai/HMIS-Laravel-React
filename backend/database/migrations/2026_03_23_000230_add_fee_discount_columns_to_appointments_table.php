<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->decimal('original_fee_amount', 12, 2)->default(0)->after('notes');
            $table->boolean('discount_enabled')->default(false)->after('original_fee_amount');
            $table->foreignId('discount_type_id')->nullable()->after('discount_enabled')->constrained('discount_types')->nullOnDelete();
            $table->decimal('discount_amount', 12, 2)->default(0)->after('discount_type_id');
            $table->decimal('total_amount', 12, 2)->default(0)->after('discount_amount');
            $table->string('currency', 10)->default('AFN')->after('total_amount');
            $table->enum('payment_status', ['pending', 'paid', 'partial', 'cancelled'])->default('pending')->after('currency');
            $table->index(['hospital_id', 'payment_status']);
        });
    }

    public function down(): void
    {
        Schema::table('appointments', function (Blueprint $table) {
            $table->dropIndex('appointments_hospital_id_payment_status_index');
            $table->dropConstrainedForeignId('discount_type_id');
            $table->dropColumn([
                'original_fee_amount',
                'discount_enabled',
                'discount_amount',
                'total_amount',
                'currency',
                'payment_status',
            ]);
        });
    }
};
