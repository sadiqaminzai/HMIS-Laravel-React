<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;
use Illuminate\Support\Facades\Schema;
use App\Models\BackupSetting;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

$defaultTime = env('DB_BACKUP_DAILY_AT', '02:00');
$defaultEnabled = (bool) env('DB_BACKUP_ENABLED', true);

if (!Schema::hasTable('backup_settings')) {
    Schedule::command('db:backup')
        ->dailyAt($defaultTime)
        ->when(fn () => $defaultEnabled)
        ->appendOutputTo(storage_path('logs/db-backup.log'));
    return;
}

$settings = BackupSetting::query()->get();

if ($settings->isEmpty()) {
    Schedule::command('db:backup')
        ->dailyAt($defaultTime)
        ->when(fn () => $defaultEnabled)
        ->appendOutputTo(storage_path('logs/db-backup.log'));
    return;
}

foreach ($settings as $setting) {
    if (!$setting->hospital_id) {
        continue;
    }

    $scheduleTime = $setting->time ?: $defaultTime;
    $scheduleEnabled = (bool) $setting->enabled;
    $retention = $setting->retention ?? 30;
    $backupDir = storage_path('app/backups' . DIRECTORY_SEPARATOR . $setting->hospital_id);

    Schedule::command('db:backup', [
        '--keep' => $retention,
        '--path' => $backupDir,
    ])
        ->dailyAt($scheduleTime)
        ->when(fn () => $scheduleEnabled)
        ->appendOutputTo(storage_path('logs/db-backup.log'));
}
