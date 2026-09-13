<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Edit Receipt on the Ultrasound receipts desk.
 *
 * Ultrasound was the one desk whose receipts could not be corrected: saving an
 * exam required Submit Result, which is the radiologist's right, so reception
 * had to delete a receipt and raise it again to fix a wrong patient or type --
 * losing its receipt number and the record of any payment on it.
 *
 * A receipt edit changes the receipt only (patient, type, date, referrer, and
 * the fee and discount within their own rights). The report, impression,
 * clinical notes and status stay with Submit Result, enforced in
 * UltrasoundExamController::update().
 *
 * Granted to nobody: correcting a financial record is a right to hand out on
 * purpose. Super admin has it regardless. Permission row only.
 */
return new class extends Migration
{
    private const NAME = 'edit_ultrasound_receipt';

    public function up(): void
    {
        if (!Schema::hasTable('permissions') || DB::table('permissions')->where('name', self::NAME)->exists()) {
            return;
        }

        DB::table('permissions')->insert([
            'name' => self::NAME,
            'guard_name' => 'web',
            'display_name' => 'Edit Ultrasound Receipt',
            'category' => 'Ultrasound',
            'description' => 'Correct an ultrasound receipt (patient, type, date, referrer) without touching the report',
            'status' => 'active',
            'is_system' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function down(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        $id = DB::table('permissions')->where('name', self::NAME)->value('id');

        if ($id && Schema::hasTable('role_has_permissions')) {
            DB::table('role_has_permissions')->where('permission_id', $id)->delete();
        }

        DB::table('permissions')->where('name', self::NAME)->delete();
    }
};
