<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * File four dental rights under the categories the rest of the system uses.
 *
 * They were created under 'Dental', which put the two dashboard rights and the
 * two cash rights away from their siblings: every other view_dashboard_* right
 * sits under 'Dashboard', and every other collect/reverse right sits under
 * 'Cash Collection'. On the permissions screen, which groups by category, that
 * made them easy to miss when handing out access.
 *
 * The CSV import cannot correct this on its own: it looks a permission up by
 * name and skips it when it already exists, so an existing row keeps whatever
 * category it was created with.
 *
 * Touches the category column only. No permission is created, removed, or
 * granted to anybody, and no role assignment changes.
 */
return new class extends Migration
{
    /** permission => [correct category, the category it was created with] */
    private const RECATEGORISE = [
        'view_dashboard_dental_fees' => ['Dashboard', 'Dental'],
        'view_dashboard_count_dental' => ['Dashboard', 'Dental'],
        'manage_dental_payments' => ['Cash Collection', 'Dental'],
        'reverse_dental_payment' => ['Cash Collection', 'Dental'],
    ];

    public function up(): void
    {
        if (!Schema::hasTable('permissions') || !Schema::hasColumn('permissions', 'category')) {
            return;
        }

        foreach (self::RECATEGORISE as $name => [$correct, $original]) {
            DB::table('permissions')
                ->where('name', $name)
                // Only move a row still sitting where it was created, so a
                // hospital that has already filed it somewhere deliberately
                // keeps its own choice.
                ->where('category', $original)
                ->update(['category' => $correct, 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('permissions') || !Schema::hasColumn('permissions', 'category')) {
            return;
        }

        foreach (self::RECATEGORISE as $name => [$correct, $original]) {
            DB::table('permissions')
                ->where('name', $name)
                ->where('category', $correct)
                ->update(['category' => $original, 'updated_at' => now()]);
        }
    }
};
