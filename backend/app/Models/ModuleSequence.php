<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;
use Throwable;

class ModuleSequence extends Model
{
    use HasFactory;

    protected $table = 'module_sequences';

    protected $fillable = [
        'hospital_id',
        'module',
        'last_number',
    ];

    public $timestamps = true;

    /**
     * The next number for a module, guaranteed not to collide with one already
     * in use.
     *
     * The stored counter alone is not trustworthy. Records imported or edited
     * outside this flow drift from it, and the next insert then violates the
     * owning table's unique index and surfaces as a 500 during a save.
     *
     * Passing the owning table and column lets the counter be floored against
     * what the table actually contains, so the sequence self-heals instead of
     * colliding.
     *
     * $scope narrows both the counter and that floor to one slice of the table
     * -- transactions number each trx_type independently, so a purchase must
     * not be floored against the newest sale.
     *
     * @param array{column: string, value: string}|null $scope
     */
    public static function incrementFor(
        int $hospitalId,
        string $module,
        ?string $table = null,
        ?string $column = null,
        ?array $scope = null
    ): int {
        $key = self::scopedModule($module, $scope);

        return DB::transaction(function () use ($hospitalId, $key, $table, $column, $scope) {
            $row = self::where('hospital_id', $hospitalId)
                ->where('module', $key)
                ->lockForUpdate()
                ->first();

            $stored = $row ? (int) $row->last_number : 0;
            $next = max($stored, self::highestUsed($hospitalId, $table, $column, $scope)) + 1;

            if ($row) {
                $row->last_number = $next;
                $row->save();
                return $next;
            }

            self::create([
                'hospital_id' => $hospitalId,
                'module' => $key,
                'last_number' => $next,
            ]);

            return $next;
        });
    }

    /**
     * Give a number back after a deletion, but never drop below one that is
     * still in use -- otherwise deleting a middle record would hand the next
     * insert a number belonging to an existing row.
     *
     * Not every module wants this: where the number appears on a document the
     * patient or supplier keeps, a deleted number must stay retired rather than
     * being handed to a different record later. Those models opt out via
     * shouldDecrementSequenceOnDelete().
     *
     * @param array{column: string, value: string}|null $scope
     */
    public static function decrementFor(
        int $hospitalId,
        string $module,
        ?string $table = null,
        ?string $column = null,
        ?array $scope = null
    ): int {
        $key = self::scopedModule($module, $scope);

        return DB::transaction(function () use ($hospitalId, $key, $table, $column, $scope) {
            $row = self::where('hospital_id', $hospitalId)
                ->where('module', $key)
                ->lockForUpdate()
                ->first();

            if (!$row || $row->last_number <= 0) {
                return 0;
            }

            $floor = self::highestUsed($hospitalId, $table, $column, $scope);
            $row->last_number = max($floor, (int) $row->last_number - 1);
            $row->save();

            return (int) $row->last_number;
        });
    }

    /**
     * Counter key for a module, optionally narrowed to one slice of it.
     *
     * Encoded into the existing `module` column rather than added as a new
     * one, so the (hospital_id, module) unique index keeps doing the work and
     * no schema change is needed to number a module by sub-type.
     *
     * @param array{column: string, value: string}|null $scope
     */
    public static function scopedModule(string $module, ?array $scope = null): string
    {
        $value = $scope['value'] ?? null;

        if ($value === null || $value === '') {
            return $module;
        }

        return $module . ':' . $value;
    }

    /**
     * Highest number already present for this hospital, including soft-deleted
     * rows -- they still occupy the unique index, so their numbers are not free.
     *
     * Returns 0 when the caller supplied no table, or when the query cannot run
     * (an older schema, say), leaving the stored counter to stand on its own.
     *
     * @param array{column: string, value: string}|null $scope
     */
    private static function highestUsed(
        int $hospitalId,
        ?string $table,
        ?string $column,
        ?array $scope = null
    ): int {
        // Both come from model constants rather than request data, but they are
        // interpolated into SQL, so anything unexpected is refused outright.
        if (!$table || !$column) {
            return 0;
        }
        if (!self::isSafeIdentifier($table) || !self::isSafeIdentifier($column)) {
            return 0;
        }

        try {
            // CAST so a column stored as a string still compares numerically.
            $query = DB::table($table)
                ->where('hospital_id', $hospitalId)
                ->selectRaw("MAX(CAST(`{$column}` AS UNSIGNED)) as highest");

            $scopeColumn = $scope['column'] ?? null;
            if ($scopeColumn && self::isSafeIdentifier($scopeColumn)) {
                // Bound as a parameter; only the identifier is interpolated.
                $query->where($scopeColumn, $scope['value'] ?? null);
            }

            return (int) ($query->value('highest') ?? 0);
        } catch (Throwable) {
            return 0;
        }
    }

    private static function isSafeIdentifier(string $identifier): bool
    {
        return (bool) preg_match('/^[A-Za-z0-9_]+$/', $identifier);
    }
}
