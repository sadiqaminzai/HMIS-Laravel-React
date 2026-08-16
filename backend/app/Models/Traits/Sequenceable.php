<?php

namespace App\Models\Traits;

use App\Models\ModuleSequence;
use Illuminate\Support\Str;

trait Sequenceable
{
    public static function bootSequenceable()
    {
        static::creating(function ($model) {
            if (!isset($model->hospital_id)) {
                return;
            }

            $column = $model->getSequenceColumnName();
            if (!$column) {
                return;
            }

            if (!empty($model->{$column})) {
                return;
            }

            $module = $model->getSequenceModuleName();
            // The table and column are passed so the sequence can be floored
            // against the numbers actually in use, rather than trusting a
            // counter that a deletion may have left behind the real maximum.
            // The scope, where a model defines one, numbers each sub-type
            // independently instead of sharing one counter across the table.
            $next = ModuleSequence::incrementFor(
                (int) $model->hospital_id,
                $module,
                $model->getTable(),
                $column,
                $model->getSequenceScope()
            );
            $model->{$column} = (string) $next;
        });

        static::created(function ($model) {
            if (!isset($model->hospital_id)) {
                return;
            }

            if (method_exists($model, 'shouldIncrementSequenceOnCreate') && !$model->shouldIncrementSequenceOnCreate()) {
                return;
            }

            $module = $model->getSequenceModuleName();
            ModuleSequence::incrementFor(
                (int) $model->hospital_id,
                $module,
                $model->getTable(),
                $model->getSequenceColumnName(),
                $model->getSequenceScope()
            );
        });

        static::deleted(function ($model) {
            if (!isset($model->hospital_id)) {
                return;
            }

            if (method_exists($model, 'isForceDeleting') && !$model->isForceDeleting()) {
                return;
            }

            if (!$model->shouldDecrementSequenceOnDelete()) {
                return;
            }

            $module = $model->getSequenceModuleName();
            ModuleSequence::decrementFor(
                (int) $model->hospital_id,
                $module,
                $model->getTable(),
                $model->getSequenceColumnName(),
                $model->getSequenceScope()
            );
        });
    }

    public function getSequenceModuleName(): string
    {
        if (property_exists(static::class, 'sequenceModule')) {
            return (string) static::$sequenceModule;
        }

        return Str::snake(class_basename(static::class));
    }

    public function getSequenceColumnName(): ?string
    {
        if (property_exists(static::class, 'sequenceColumn') && !empty(static::$sequenceColumn)) {
            return (string) static::$sequenceColumn;
        }

        return null;
    }

    public function shouldIncrementSequenceOnCreate(): bool
    {
        return $this->getSequenceColumnName() === null;
    }

    /**
     * Sub-type this record is numbered within, or null to share one counter
     * across the whole table.
     *
     * A model opts in by declaring $sequenceScopeColumn; the value is read from
     * the record itself, so each distinct value gets its own sequence.
     *
     * @return array{column: string, value: string}|null
     */
    public function getSequenceScope(): ?array
    {
        if (!property_exists(static::class, 'sequenceScopeColumn') || empty(static::$sequenceScopeColumn)) {
            return null;
        }

        $column = (string) static::$sequenceScopeColumn;
        $value = $this->{$column};

        if ($value === null || $value === '') {
            return null;
        }

        return ['column' => $column, 'value' => (string) $value];
    }

    /**
     * Whether deleting a record releases its number for reuse.
     *
     * Defaults to true to preserve existing behaviour. Models whose number is
     * printed on a document someone keeps should return false: reissuing a
     * retired number to a different record makes two documents claim the same
     * identity.
     */
    public function shouldDecrementSequenceOnDelete(): bool
    {
        return true;
    }
}
