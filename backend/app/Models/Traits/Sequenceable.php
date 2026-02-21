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
            $next = ModuleSequence::incrementFor((int) $model->hospital_id, $module);
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
            ModuleSequence::incrementFor((int) $model->hospital_id, $module);
        });

        static::deleted(function ($model) {
            if (!isset($model->hospital_id)) {
                return;
            }

            if (method_exists($model, 'isForceDeleting') && !$model->isForceDeleting()) {
                return;
            }

            $module = $model->getSequenceModuleName();
            ModuleSequence::decrementFor((int) $model->hospital_id, $module);
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
}
