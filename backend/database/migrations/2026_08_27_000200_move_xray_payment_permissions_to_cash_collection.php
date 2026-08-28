<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Put the X-Ray cash rights where every other module's already are.
 *
 * X-Ray arrived after the Cash Collection group was assembled, so its collect
 * and reverse permissions were filed under Radiology with the clinical rights.
 * The Payment Collection desk already reads them -- the module is listed in
 * PaymentCollectionController::MODULES -- but the Roles screen builds its
 * "Payment Collection - Take Money" and "- Put Money Back" panels from the
 * category, so X-Ray was the one module a hospital could not grant a cashier
 * without hunting through Radiology for it.
 *
 * Only the category moves. Renaming would silently strip the right from any
 * role that already holds it, and nothing is granted here: who collects stays
 * the hospital's decision on the Roles screen.
 */
return new class extends Migration
{
    private const CATEGORY = 'Cash Collection';

    private const PERMISSIONS = [
        'manage_xray_payments',
        'reverse_xray_payment',
    ];

    public function up(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        DB::table('permissions')
            ->whereIn('name', self::PERMISSIONS)
            ->update(['category' => self::CATEGORY, 'updated_at' => now()]);
    }

    public function down(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        DB::table('permissions')
            ->whereIn('name', self::PERMISSIONS)
            ->update(['category' => 'Radiology', 'updated_at' => now()]);
    }
};
