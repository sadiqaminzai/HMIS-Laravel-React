<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * File the money-register rights under Accounts, where their screens now live.
 *
 * Expenses, Other Income, their categories and the ledger all sat under a
 * "Finance" heading on the roles screen. Finance is no longer a menu -- those
 * screens moved to Accounts -- so an administrator looking for "who may approve
 * an expense" was opening a tab named after a module that no longer exists,
 * while the Accounts tab showed almost nothing.
 *
 * Only the `category` label moves. No permission is renamed, added or removed,
 * so nothing any role already holds is affected: this is purely where the
 * checkbox appears.
 *
 * Discounts deliberately stay under Finance: a discount is applied on a
 * clinical receipt at the counter, not in the account books.
 */
return new class extends Migration
{
    private const PREFIXES = [
        'expenses',
        'expense_categories',
        'other_incomes',
        'other_income_categories',
        'ledger',
    ];

    private const VERBS = ['view', 'add', 'edit', 'delete', 'export', 'import', 'print', 'manage'];

    /** Also moved: the approval and date rights added alongside these screens. */
    private const EXTRA = [
        'approve_expenses',
        'approve_other_incomes',
        'edit_expense_date',
        'edit_other_income_date',
    ];

    private function names(): array
    {
        $names = self::EXTRA;

        foreach (self::PREFIXES as $subject) {
            foreach (self::VERBS as $verb) {
                $names[] = $verb . '_' . $subject;
            }
        }

        return $names;
    }

    public function up(): void
    {
        if (!Schema::hasTable('permissions') || !Schema::hasColumn('permissions', 'category')) {
            return;
        }

        DB::table('permissions')
            ->whereIn('name', $this->names())
            ->update(['category' => 'Accounts', 'updated_at' => now()]);
    }

    public function down(): void
    {
        if (!Schema::hasTable('permissions') || !Schema::hasColumn('permissions', 'category')) {
            return;
        }

        DB::table('permissions')
            ->whereIn('name', $this->names())
            ->update(['category' => 'Finance', 'updated_at' => now()]);
    }
};
