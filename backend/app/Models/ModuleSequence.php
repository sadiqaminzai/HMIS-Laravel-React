<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

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

    public static function incrementFor(int $hospitalId, string $module): int
    {
        return DB::transaction(function () use ($hospitalId, $module) {
            $row = self::where('hospital_id', $hospitalId)
                ->where('module', $module)
                ->lockForUpdate()
                ->first();

            if ($row) {
                $row->last_number = $row->last_number + 1;
                $row->save();
                return (int) $row->last_number;
            }

            $created = self::create([
                'hospital_id' => $hospitalId,
                'module' => $module,
                'last_number' => 1,
            ]);

            return (int) $created->last_number;
        });
    }

    public static function decrementFor(int $hospitalId, string $module): int
    {
        return DB::transaction(function () use ($hospitalId, $module) {
            $row = self::where('hospital_id', $hospitalId)
                ->where('module', $module)
                ->lockForUpdate()
                ->first();

            if ($row && $row->last_number > 0) {
                $row->last_number = $row->last_number - 1;
                $row->save();
                return (int) $row->last_number;
            }

            return 0;
        });
    }
}
