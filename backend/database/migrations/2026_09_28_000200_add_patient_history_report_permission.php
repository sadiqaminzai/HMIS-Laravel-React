<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Patient History gets its own report right.
 *
 * It was the one entry under Reports with no right of its own: it opened for
 * anyone who could view or register patients -- every receptionist -- and the
 * API behind it additionally let any doctor through. It is a report on one
 * patient's whole record across every desk, so it now sits beside the other
 * report desks and is granted like them.
 *
 * NOT backfilled, deliberately. Copying it to everyone who holds a patient
 * right would reproduce exactly the access this closes. Until a role is given
 * it, only super admin sees Patient History. Permission row only.
 */
return new class extends Migration
{
    private const NAME = 'view_reports_patient_history';

    public function up(): void
    {
        if (!Schema::hasTable('permissions') || DB::table('permissions')->where('name', self::NAME)->exists()) {
            return;
        }

        DB::table('permissions')->insert([
            'name' => self::NAME,
            'guard_name' => 'web',
            'display_name' => 'Reports: Patient History',
            'category' => 'Reports',
            'description' => "One patient's visits, tests, scans, operations, prescriptions and purchases across every desk",
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
