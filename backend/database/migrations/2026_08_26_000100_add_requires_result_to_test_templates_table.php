<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Let a test be billed without ever reaching the result-entry screen.
 *
 * Analysers such as the CBC counter print their own report straight from the
 * machine, so re-keying all 21 parameters into ShifaaScript was pure duplicate
 * work for the technician. Reception must still be able to order and invoice
 * the test, which is why this is a separate flag rather than `status` --
 * deactivating the test would hide it from the order form as well.
 *
 * Existing tests keep today's behaviour: everything requires a result.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('test_templates', function (Blueprint $table) {
            $table->boolean('requires_result')->default(true)->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('test_templates', function (Blueprint $table) {
            $table->dropColumn('requires_result');
        });
    }
};
