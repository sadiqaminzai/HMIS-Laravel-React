<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Who approved or rejected an expense, and when.
 *
 * `created_by`/`updated_by` already answer "who typed this in", but approving a
 * payment is the decision that matters and it was landing in `updated_by` like
 * any other edit -- so changing the title after an approval silently overwrote
 * the approver's name. A sign-off has to survive later edits, which means its
 * own columns.
 *
 * Two pairs rather than one, because "decided_by + decision" would lose the
 * history the moment a rejected entry is re-approved: keeping them apart lets a
 * row show that it was rejected on Monday and approved on Tuesday.
 *
 * Names are stored, not user ids, to match `created_by`/`updated_by` on these
 * tables. Consistency wins here: a mixture of ids and names in adjacent columns
 * is how a report ends up printing "7" as an approver.
 */
return new class extends Migration
{
    private const TABLES = ['expenses', 'other_incomes'];

    private const COLUMNS = [
        'approved_by' => 'string',
        'approved_at' => 'timestamp',
        'rejected_by' => 'string',
        'rejected_at' => 'timestamp',
    ];

    public function up(): void
    {
        foreach (self::TABLES as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($table) {
                foreach (self::COLUMNS as $column => $type) {
                    if (Schema::hasColumn($table, $column)) {
                        continue;
                    }

                    if ($type === 'timestamp') {
                        $blueprint->timestamp($column)->nullable();
                    } else {
                        $blueprint->string($column)->nullable();
                    }
                }
            });
        }
    }

    public function down(): void
    {
        foreach (self::TABLES as $table) {
            if (!Schema::hasTable($table)) {
                continue;
            }

            Schema::table($table, function (Blueprint $blueprint) use ($table) {
                $drop = array_filter(
                    array_keys(self::COLUMNS),
                    fn ($column) => Schema::hasColumn($table, $column)
                );

                if ($drop) {
                    $blueprint->dropColumn(array_values($drop));
                }
            });
        }
    }
};
