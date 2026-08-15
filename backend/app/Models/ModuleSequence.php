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
     * The stored counter alone is not trustworthy. Deleting a record decrements
     * it, so removing anything other than the newest row leaves the counter
     * below a number that is still taken -- and the next insert then violates
     * the (hospital_id, serial_no) unique index and surfaces as a 500 during a
     * save. Records imported or edited outside this flow drift the same way.
     *
     * Passing the owning table and column lets the counter be floored against
     * what the table actually contains, so the sequence self-heals instead of
     * colliding.
     */
    public static function incrementFor(
        int $hospitalId,
        string $module,
        ?string $table = null,
        ?string $column = null
    ): int {
        return DB::transaction(function () use ($hospitalId, $module, $table, $column) {
            $row = self::where('hospital_id', $hospitalId)
                ->where('module', $module)
                ->lockForUpdate()
                ->first();

            $stored = $row ? (int) $row->last_number : 0;
            $next = max($stored, self::highestUsed($hospitalId, $table, $column)) + 1;

            if ($row) {
                $row->last_number = $next;
                $row->save();
                return $next;
            }

            self::create([
                'hospital_id' => $hospitalId,
                'module' => $module,
                'last_number' => $next,
            ]);

            return $next;
        });
    }

    /**
     * Give a number back after a deletion, but never drop below one that is
     * still in use -- otherwise deleting a middle record would hand the next
     * insert a number belonging to an existing row.
     */
    public static function decrementFor(
        int $hospitalId,
        string $module,
        ?string $table = null,
        ?string $column = null
    ): int {
        return DB::transaction(function () use ($hospitalId, $module, $table, $column) {
            $row = self::where('hospital_id', $hospitalId)
                ->where('module', $module)
                ->lockForUpdate()
                ->first();

            if (!$row || $row->last_number <= 0) {
                return 0;
            }

            $floor = self::highestUsed($hospitalId, $table, $column);
            $row->last_number = max($floor, (int) $row->last_number - 1);
            $row->save();

            return (int) $row->last_number;
        });
    }

    /**
     * Highest number already present for this hospital, including soft-deleted
     * rows -- they still occupy the unique index, so their numbers are not free.
     *
     * Returns 0 when the caller supplied no table, or when the query cannot run
     * (an older schema, say), leaving the stored counter to stand on its own.
     */
    private static function highestUsed(int $hospitalId, ?string $table, ?string $column): int
    {
        // Both come from model constants rather than request data, but they are
        // interpolated into SQL, so anything unexpected is refused outright.
        if (!$table || !$column) {
            return 0;
        }
        if (!preg_match('/^[A-Za-z0-9_]+$/', $table) || !preg_match('/^[A-Za-z0-9_]+$/', $column)) {
            return 0;
        }

        try {
            // CAST so a column stored as a string still compares numerically.
            $max = DB::table($table)
                ->where('hospital_id', $hospitalId)
                ->selectRaw("MAX(CAST(`{$column}` AS UNSIGNED)) as highest")
                ->value('highest');

            return (int) ($max ?? 0);
        } catch (Throwable) {
            return 0;
        }
    }
}
