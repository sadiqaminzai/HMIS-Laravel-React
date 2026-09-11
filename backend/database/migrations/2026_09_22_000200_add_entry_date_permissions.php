<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Who may choose the date an expense or income entry is filed under.
 *
 * The date is the one field on these forms that decides which period the money
 * lands in. Leaving it freely editable lets a clerk move spending out of a
 * closed month -- deliberately or by mistyping a year -- and the books stop
 * matching what was reported. Everyone else gets the field pre-filled with
 * today and read-only, which is the correct entry for almost every row.
 *
 * Granting the right does not bypass anything else: the entry still needs the
 * add or edit permission to be saved at all.
 */
return new class extends Migration
{
    private const PERMISSIONS = [
        ['edit_expense_date', 'Edit Expense Date', 'Choose a date other than today when filing an expense'],
        ['edit_other_income_date', 'Edit Income Date', 'Choose a date other than today when filing other income'],
    ];

    public function up(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        foreach (self::PERMISSIONS as [$name, $displayName, $description]) {
            if (DB::table('permissions')->where('name', $name)->exists()) {
                continue;
            }

            $row = [
                'name' => $name,
                'display_name' => $displayName,
                'category' => 'Accounts',
                'created_at' => now(),
                'updated_at' => now(),
            ];

            if (Schema::hasColumn('permissions', 'guard_name')) {
                $row['guard_name'] = 'web';
            }
            if (Schema::hasColumn('permissions', 'status')) {
                $row['status'] = 'active';
            }
            if (Schema::hasColumn('permissions', 'is_system')) {
                $row['is_system'] = 1;
            }
            if (Schema::hasColumn('permissions', 'description')) {
                $row['description'] = $description;
            }

            DB::table('permissions')->insert($row);
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        $names = array_column(self::PERMISSIONS, 0);

        if (Schema::hasTable('permission_role')) {
            $ids = DB::table('permissions')->whereIn('name', $names)->pluck('id');
            DB::table('permission_role')->whereIn('permission_id', $ids)->delete();
        }

        DB::table('permissions')->whereIn('name', $names)->delete();
    }
};
