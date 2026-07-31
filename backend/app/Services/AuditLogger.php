<?php

namespace App\Services;

use App\Models\AuditLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

/**
 * Central writer for the audit trail.
 *
 * Every method is best-effort: auditing must never break the request that
 * triggered it, so failures are logged and swallowed.
 */
class AuditLogger
{
    /**
     * Attribute names that must never be persisted into the trail.
     *
     * @var array<int, string>
     */
    private const REDACTED = [
        'password',
        'password_confirmation',
        'remember_token',
        'api_token',
        'access_token',
        'refresh_token',
        'verification_token',
        'two_factor_secret',
        'two_factor_recovery_codes',
    ];

    private static ?bool $tableExists = null;

    /**
     * Record an arbitrary audit entry.
     *
     * @param  array<string, mixed>  $attributes
     */
    public static function log(array $attributes): ?AuditLog
    {
        if (!self::tableExists()) {
            return null;
        }

        try {
            $request = request();
            $user = $attributes['user'] ?? (($request && $request->user()) ? $request->user() : auth()->user());
            unset($attributes['user']);

            $payload = array_merge([
                'hospital_id' => $user->hospital_id ?? null,
                'user_id' => $user->id ?? null,
                'user_name' => $user->name ?? null,
                'user_role' => $user->role ?? null,
                'record_id' => null,
                'record_label' => null,
                'old_values' => null,
                'new_values' => null,
                'ip_address' => $request?->ip(),
                'user_agent' => $request ? substr((string) $request->userAgent(), 0, 512) : null,
                'url' => $request ? substr((string) $request->fullUrl(), 0, 512) : null,
                'method' => $request?->method(),
                'description' => null,
            ], $attributes);

            $payload['old_values'] = self::redact($payload['old_values']);
            $payload['new_values'] = self::redact($payload['new_values']);
            $payload['record_id'] = $payload['record_id'] === null ? null : (string) $payload['record_id'];

            return AuditLog::create($payload);
        } catch (\Throwable $e) {
            Log::warning('Failed to write audit log: '.$e->getMessage());

            return null;
        }
    }

    /**
     * Record an action performed against an Eloquent model.
     *
     * @param  array<string, mixed>|null  $oldValues
     * @param  array<string, mixed>|null  $newValues
     */
    public static function logModel(
        string $module,
        string $action,
        Model $model,
        ?array $oldValues = null,
        ?array $newValues = null,
        ?string $description = null
    ): ?AuditLog {
        return self::log([
            'hospital_id' => $model->hospital_id ?? (request()?->user()->hospital_id ?? null),
            'module' => $module,
            'action' => $action,
            'record_id' => $model->getKey(),
            'record_label' => self::labelFor($model),
            'old_values' => $oldValues,
            'new_values' => $newValues,
            'description' => $description,
        ]);
    }

    /**
     * Best-effort human readable name for a record.
     */
    public static function labelFor(Model $model): ?string
    {
        foreach (['name', 'title', 'full_name', 'patient_name', 'order_number', 'invoice_number', 'email', 'code'] as $key) {
            $value = $model->getAttribute($key);
            if (is_string($value) && $value !== '') {
                return substr($value, 0, 191);
            }
        }

        return null;
    }

    /**
     * Strip sensitive attributes before persisting a value snapshot.
     *
     * @param  mixed  $values
     * @return array<string, mixed>|null
     */
    private static function redact($values): ?array
    {
        if (empty($values) || !is_array($values)) {
            return null;
        }

        foreach (array_keys($values) as $key) {
            if (in_array($key, self::REDACTED, true)) {
                $values[$key] = '********';
            }
        }

        return $values;
    }

    /**
     * Guards against auditing before the table has been migrated.
     */
    private static function tableExists(): bool
    {
        if (self::$tableExists === null) {
            try {
                self::$tableExists = Schema::hasTable('audit_logs');
            } catch (\Throwable $e) {
                self::$tableExists = false;
            }
        }

        return self::$tableExists;
    }
}
