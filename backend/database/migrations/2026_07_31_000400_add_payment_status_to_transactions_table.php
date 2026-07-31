<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Adds the financial-control fields to pharmacy transactions.
 *
 * Payment state used to be implied by `due_amount`. The Finance module needs an
 * explicit, filterable status plus a record of when and how money moved, so the
 * operational side (creating an invoice from a prescription) stays separate
 * from the financial side (settling it).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->enum('payment_status', ['pending', 'partial', 'paid'])
                ->default('pending')
                ->after('due_amount');
            $table->string('payment_method', 50)->nullable()->after('payment_status');
            $table->string('payment_reference', 191)->nullable()->after('payment_method');
            $table->date('payment_due_date')->nullable()->after('payment_reference');
            $table->timestamp('last_payment_at')->nullable()->after('payment_due_date');
            $table->text('finance_note')->nullable()->after('last_payment_at');
            $table->string('settled_by', 191)->nullable()->after('finance_note');

            $table->index(['hospital_id', 'payment_status']);
            $table->index(['hospital_id', 'trx_type', 'payment_status']);
        });

        // Backfill existing rows from the amounts already recorded.
        DB::table('transactions')->where('due_amount', '<=', 0)->update([
            'payment_status' => 'paid',
            'last_payment_at' => DB::raw('updated_at'),
        ]);
        DB::table('transactions')
            ->where('due_amount', '>', 0)
            ->where('paid_amount', '>', 0)
            ->update(['payment_status' => 'partial']);
        DB::table('transactions')
            ->where('due_amount', '>', 0)
            ->where('paid_amount', '<=', 0)
            ->update(['payment_status' => 'pending']);
    }

    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropIndex(['hospital_id', 'payment_status']);
            $table->dropIndex(['hospital_id', 'trx_type', 'payment_status']);
            $table->dropColumn([
                'payment_status',
                'payment_method',
                'payment_reference',
                'payment_due_date',
                'last_payment_at',
                'finance_note',
                'settled_by',
            ]);
        });
    }
};
