<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Record WHICH user submitted a lab result, not just their name.
 *
 * A result may be corrected by the person who entered it, on the day they
 * entered it, and by nobody else. Deciding "the same person" from
 * `completed_by` alone is unsafe in a hospital that employs two technicians
 * called Ahmad -- one could reopen the other's result.
 *
 * Nullable, and the rule falls back to the name when it is empty, so results
 * already submitted when this ships keep behaving as they do today rather than
 * locking mid-shift.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('lab_order_items', 'completed_by_id')) {
            return;
        }

        Schema::table('lab_order_items', function (Blueprint $table) {
            $table->unsignedBigInteger('completed_by_id')->nullable()->after('completed_by');
            $table->foreign('completed_by_id')->references('id')->on('users')->nullOnDelete();
            $table->index(['completed_by_id', 'completed_at']);
        });
    }

    public function down(): void
    {
        if (!Schema::hasColumn('lab_order_items', 'completed_by_id')) {
            return;
        }

        Schema::table('lab_order_items', function (Blueprint $table) {
            $table->dropForeign(['completed_by_id']);
            $table->dropIndex(['completed_by_id', 'completed_at']);
            $table->dropColumn('completed_by_id');
        });
    }
};
