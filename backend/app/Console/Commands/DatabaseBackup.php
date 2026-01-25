<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\Process\Process;
use App\Models\BackupSetting;

class DatabaseBackup extends Command
{
    protected $signature = 'db:backup
        {--connection= : Database connection name}
        {--path= : Output directory (defaults to storage/app/backups)}
        {--filename= : Output filename without extension}
        {--keep= : Number of recent backups to keep}';

    protected $description = 'Create a database backup file.';

    public function handle(): int
    {
        $connection = $this->option('connection') ?: config('database.default');
        $config = config("database.connections.{$connection}");

        if (!$config) {
            $this->error("Database connection [{$connection}] not found.");
            return self::FAILURE;
        }

        $directory = $this->option('path') ?: storage_path('app/backups');
        File::ensureDirectoryExists($directory);

        $timestamp = now()->format('Ymd_His');
        $customName = $this->option('filename');
        $basePrefix = $customName ?: "backup_{$connection}_";
        $baseName = $customName ?: "{$basePrefix}{$timestamp}";

        $driver = $config['driver'] ?? '';
        $extension = match ($driver) {
            'sqlite' => 'sqlite',
            default => 'sql',
        };

        $fullPath = $directory.DIRECTORY_SEPARATOR."{$baseName}.{$extension}";

        try {
            match ($driver) {
                'mysql' => $this->backupMySql($config, $fullPath),
                'sqlite' => $this->backupSqlite($config, $fullPath),
                default => $this->unsupportedDriver($driver),
            };
        } catch (\Throwable $e) {
            $this->error($e->getMessage());
            Log::error('Database backup failed.', ['error' => $e->getMessage()]);
            return self::FAILURE;
        }

        $this->info("Backup created: {$fullPath}");
        $this->pruneBackups($directory, $basePrefix, $this->resolveRetention());

        return self::SUCCESS;
    }

    private function backupMySql(array $config, string $fullPath): void
    {
        $binary = $this->resolveMysqlDumpBinary();
        $database = $config['database'] ?? '';
        $host = env('DB_BACKUP_MYSQL_HOST', $config['host'] ?? 'localhost');
        $port = (string) env('DB_BACKUP_MYSQL_PORT', (string) ($config['port'] ?? 3306));
        $username = $config['username'] ?? '';
        $password = $config['password'] ?? '';

        if ($database === '' || $username === '') {
            throw new \RuntimeException('Database name or username not configured for backup.');
        }

        // Build command string for shell execution (avoids Symfony Process socket issues on Windows)
        $cmd = sprintf(
            '"%s" --user=%s --host=%s --port=%s --single-transaction --quick --lock-tables=false',
            $binary,
            escapeshellarg($username),
            escapeshellarg($host),
            escapeshellarg($port)
        );

        if ($password !== '') {
            $cmd .= ' --password=' . escapeshellarg($password);
        }

        $cmd .= ' --databases ' . escapeshellarg($database);
        $cmd .= ' --result-file=' . escapeshellarg($fullPath);
        $cmd .= ' 2>&1';

        $output = shell_exec($cmd);

        if (!File::exists($fullPath) || File::size($fullPath) === 0) {
            throw new \RuntimeException('mysqldump failed: ' . ($output ?: 'Unknown error'));
        }
    }

    private function resolveMysqlDumpBinary(): string
    {
        $configured = env('DB_BACKUP_MYSQLDUMP_PATH');
        if (!empty($configured)) {
            return $configured;
        }

        $candidates = [];
        if (PHP_OS_FAMILY === 'Windows') {
            $candidates = [
                'C:\\xampp\\mysql\\bin\\mysqldump.exe',
                'C:\\Program Files\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
                'C:\\Program Files (x86)\\MySQL\\MySQL Server 8.0\\bin\\mysqldump.exe',
            ];
        } else {
            $candidates = [
                '/usr/bin/mysqldump',
                '/usr/local/bin/mysqldump',
            ];
        }

        foreach ($candidates as $path) {
            if (File::exists($path)) {
                return $path;
            }
        }

        return 'mysqldump';
    }

    private function backupSqlite(array $config, string $fullPath): void
    {
        $databasePath = $config['database'] ?? '';

        if ($databasePath === '' || $databasePath === ':memory:') {
            throw new \RuntimeException('SQLite database path is not available for backup.');
        }

        if (!File::exists($databasePath)) {
            throw new \RuntimeException("SQLite database file not found at {$databasePath}.");
        }

        File::copy($databasePath, $fullPath);
    }

    private function unsupportedDriver(string $driver): void
    {
        throw new \RuntimeException("Database driver [{$driver}] is not supported for backup.");
    }

    private function pruneBackups(string $directory, string $basePrefix, int $keep): void
    {
        if ($keep <= 0) {
            return;
        }

        $pattern = $directory.DIRECTORY_SEPARATOR.$basePrefix.'*';
        $files = collect(File::glob($pattern))
            ->sortByDesc(fn ($path) => File::lastModified($path))
            ->values();

        $files->slice($keep)->each(function ($path) {
            File::delete($path);
        });
    }

    private function resolveRetention(): int
    {
        $keep = $this->option('keep');
        if ($keep !== null && $keep !== '') {
            return max(0, (int) $keep);
        }

        if (Schema::hasTable('backup_settings')) {
            $setting = BackupSetting::query()->first();
            if ($setting && $setting->retention !== null) {
                return max(0, (int) $setting->retention);
            }
        }

        return 30;
    }
}
