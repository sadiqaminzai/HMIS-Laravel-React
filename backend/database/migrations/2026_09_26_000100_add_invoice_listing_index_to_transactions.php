<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The index the Invoices datatable actually sorts on.
 *
 * The screen opens one tab at a time and orders by date, newest first, so
 * every query is "this hospital, this trx_type, latest 50". The closest
 * existing index was (hospital_id, created_at), which MySQL chose and then
 * filtered trx_type out of by hand -- reading every one of the hospital's rows
 * to return fifty.
 *
 * Adding created_at as a third column lets the same range scan stop after the
 * page, so the cost stops following the invoice count. That matters here
 * precisely because the count keeps growing: this is the table that made the
 * live screen hang.
 *
 * Index only. No column, no row and no value is touched.
 */
return new class extends Migration
{
    private const INDEX = 'transactions_hospital_trx_type_created_at_index';

    public function up(): void
    {
        if (!Schema::hasTable('transactions') || $this->indexExists()) {
            return;
        }

        Schema::table('transactions', function (Blueprint $table) {
            $table->index(['hospital_id', 'trx_type', 'created_at'], self::INDEX);
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('transactions') || !$this->indexExists()) {
            return;
        }

        Schema::table('transactions', function (Blueprint $table) {
            $table->dropIndex(self::INDEX);
        });
    }

    private function indexExists(): bool
    {
        return collect(Schema::getConnection()->select('SHOW INDEX FROM transactions'))
            ->contains(fn ($index) => $index->Key_name === self::INDEX);
    }
};
