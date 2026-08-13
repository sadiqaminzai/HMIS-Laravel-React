<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-invoice-type column visibility for the pharmacy entry form.
 *
 * Stored as JSON keyed by transaction type so a hospital can, for example, keep
 * batch and expiry on purchases while hiding them on counter sales where FIFO
 * already picks the lot.
 *
 * Nullable: a hospital with no stored value falls back to config/invoice_fields.php,
 * so existing hospitals keep working untouched.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            if (!Schema::hasColumn('hospital_settings', 'invoice_fields')) {
                $table->json('invoice_fields')->nullable()->after('print_paper_sizes');
            }
        });
    }

    public function down(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            if (Schema::hasColumn('hospital_settings', 'invoice_fields')) {
                $table->dropColumn('invoice_fields');
            }
        });
    }
};
