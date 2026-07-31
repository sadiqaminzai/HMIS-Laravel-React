<?php

namespace App\Observers;

use App\Services\AuditLogger;
use Illuminate\Database\Eloquent\Model;

/**
 * Generic observer that writes create/update/delete entries to the audit trail.
 *
 * It is attached to models from AppServiceProvider, which also supplies the
 * module label shown in the Audit Log UI. Doing it there keeps the existing
 * models untouched.
 */
class AuditObserver
{
    /**
     * Model class => module label, populated by AppServiceProvider.
     *
     * @var array<class-string, string>
     */
    private static array $modules = [];

    /**
     * @param  array<class-string, string>  $modules
     */
    public static function setModules(array $modules): void
    {
        self::$modules = $modules;
    }

    public function created(Model $model): void
    {
        AuditLogger::logModel(
            $this->moduleFor($model),
            'create',
            $model,
            null,
            $model->getAttributes()
        );
    }

    public function updated(Model $model): void
    {
        $changes = $model->getChanges();
        // Touch-only saves (e.g. updated_at bumps) and login bookkeeping are
        // noise, not activity. Logins are recorded separately by AuthController.
        unset($changes['updated_at'], $changes['last_login_at']);

        if (empty($changes)) {
            return;
        }

        $original = [];
        foreach (array_keys($changes) as $key) {
            $original[$key] = $model->getOriginal($key);
        }

        // A password change is a security event in its own right, not a plain edit.
        if ($model instanceof \App\Models\User && array_key_exists('password', $changes)) {
            AuditLogger::logModel(
                $this->moduleFor($model),
                'password_change',
                $model,
                null,
                null,
                'Password changed for '.($model->email ?? $model->name ?? 'user #'.$model->getKey())
            );

            unset($changes['password'], $original['password']);

            if (empty($changes)) {
                return;
            }
        }

        AuditLogger::logModel(
            $this->moduleFor($model),
            'update',
            $model,
            $original,
            $changes
        );
    }

    public function deleted(Model $model): void
    {
        AuditLogger::logModel(
            $this->moduleFor($model),
            'delete',
            $model,
            $model->getOriginal(),
            null
        );
    }

    public function restored(Model $model): void
    {
        AuditLogger::logModel(
            $this->moduleFor($model),
            'restore',
            $model,
            null,
            $model->getAttributes()
        );
    }

    private function moduleFor(Model $model): string
    {
        return self::$modules[get_class($model)] ?? class_basename($model);
    }
}
