<?php

namespace App\Http\Controllers;

use App\Models\BackupSetting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Response;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class DatabaseBackupController extends Controller
{
    /**
     * List all available backups
     */
    public function index(Request $request)
    {
        $hospitalId = $this->resolveHospitalId($request);
        if (!$hospitalId) {
            return response()->json(['message' => 'Hospital is required'], 422);
        }

        $backupDir = storage_path('app/backups' . DIRECTORY_SEPARATOR . $hospitalId);

        if (!File::exists($backupDir)) {
            return response()->json([]);
        }

        $files = collect(File::files($backupDir))
            ->map(function ($file) {
                return [
                    'name' => $file->getFilename(),
                    'size' => $file->getSize(),
                    'created_at' => $file->getMTime(),
                    'formatted_size' => $this->formatBytes($file->getSize()),
                    'formatted_date' => date('Y-m-d H:i:s', $file->getMTime()),
                ];
            })
            ->sortByDesc('created_at')
            ->values();

        return response()->json($files);
    }

    /**
     * Create a new backup
     */
    public function store(Request $request)
    {
        $hospitalId = $this->resolveHospitalId($request);
        if (!$hospitalId) {
            return response()->json(['message' => 'Hospital is required'], 422);
        }

        try {
            $keep = $this->resolveRetention($hospitalId);
            $backupDir = storage_path('app/backups' . DIRECTORY_SEPARATOR . $hospitalId);
            File::ensureDirectoryExists($backupDir);
            $exitCode = Artisan::call('db:backup', [
                '--keep' => $keep,
                '--path' => $backupDir,
            ]);

            if ($exitCode !== 0) {
                $output = trim(Artisan::output());
                Log::error('Database backup command failed', ['exit_code' => $exitCode]);
                return response()->json([
                    'message' => $output !== '' ? $output : 'Backup creation failed.',
                ], 500);
            }

            $output = Artisan::output();

            // Extract filename from output if available
            preg_match('/Backup created: (.+)/', $output, $matches);
            $filename = isset($matches[1]) ? basename($matches[1]) : null;

            return response()->json([
                'message' => 'Backup created successfully.',
                'filename' => $filename,
            ]);
        } catch (\Throwable $e) {
            Log::error('Database backup error', ['error' => $e->getMessage()]);
            return response()->json([
                'message' => 'Backup failed: ' . $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get backup settings
     */
    public function settings(Request $request)
    {
        $hospitalId = $this->resolveHospitalId($request);
        if (!$hospitalId) {
            return response()->json(['message' => 'Hospital is required'], 422);
        }

        if (!Schema::hasTable('backup_settings')) {
            return response()->json([
                'enabled' => true,
                'time' => '02:00',
                'retention' => 30,
            ]);
        }

        $setting = $this->getOrCreateSetting($hospitalId);

        return response()->json([
            'enabled' => (bool) $setting->enabled,
            'time' => $setting->time,
            'retention' => (int) $setting->retention,
        ]);
    }

    /**
     * Update backup settings
     */
    public function updateSettings(Request $request)
    {
        $hospitalId = $this->resolveHospitalId($request);
        if (!$hospitalId) {
            return response()->json(['message' => 'Hospital is required'], 422);
        }

        if (!Schema::hasTable('backup_settings')) {
            return response()->json([
                'message' => 'Backup settings table not found. Run migrations first.',
            ], 500);
        }

        $data = $request->validate([
            'enabled' => ['boolean'],
            'time' => ['required', 'date_format:H:i'],
            'retention' => ['required', 'integer', 'min:1', 'max:365'],
        ]);

        $setting = $this->getOrCreateSetting($hospitalId);
        $setting->update($data);

        return response()->json([
            'enabled' => (bool) $setting->enabled,
            'time' => $setting->time,
            'retention' => (int) $setting->retention,
        ]);
    }

    /**
     * Download a backup file
     */
    public function download(Request $request, string $filename)
    {
        $hospitalId = $this->resolveHospitalId($request);
        if (!$hospitalId) {
            return response()->json(['message' => 'Hospital is required'], 422);
        }

        $backupDir = storage_path('app/backups' . DIRECTORY_SEPARATOR . $hospitalId);
        $filePath = $backupDir . DIRECTORY_SEPARATOR . $filename;

        // Security: prevent directory traversal
        $realPath = realpath($filePath);
        $realBackupDir = realpath($backupDir);

        if (
            !$realPath ||
            !$realBackupDir ||
            strpos($realPath, $realBackupDir) !== 0 ||
            !File::exists($filePath)
        ) {
            return response()->json(['message' => 'Backup file not found.'], 404);
        }

        return Response::download($filePath);
    }

    /**
     * Delete a backup file
     */
    public function destroy(Request $request, string $filename)
    {
        $hospitalId = $this->resolveHospitalId($request);
        if (!$hospitalId) {
            return response()->json(['message' => 'Hospital is required'], 422);
        }

        $backupDir = storage_path('app/backups' . DIRECTORY_SEPARATOR . $hospitalId);
        $filePath = $backupDir . DIRECTORY_SEPARATOR . $filename;

        // Security: prevent directory traversal
        $realPath = realpath($filePath);
        $realBackupDir = realpath($backupDir);

        if (
            !$realPath ||
            !$realBackupDir ||
            strpos($realPath, $realBackupDir) !== 0 ||
            !File::exists($filePath)
        ) {
            return response()->json(['message' => 'Backup file not found.'], 404);
        }

        File::delete($filePath);

        return response()->json(['message' => 'Backup deleted successfully.']);
    }

    /**
     * Format bytes to human-readable size
     */
    private function formatBytes(int $bytes, int $precision = 2): string
    {
        $units = ['B', 'KB', 'MB', 'GB', 'TB'];

        for ($i = 0; $bytes > 1024 && $i < count($units) - 1; $i++) {
            $bytes /= 1024;
        }

        return round($bytes, $precision) . ' ' . $units[$i];
    }

    private function getOrCreateSetting(int $hospitalId): BackupSetting
    {
        return BackupSetting::firstOrCreate(
            ['hospital_id' => $hospitalId],
            ['enabled' => true, 'time' => '02:00', 'retention' => 30]
        );
    }

    private function resolveRetention(int $hospitalId): int
    {
        if (!Schema::hasTable('backup_settings')) {
            return 30;
        }

        $setting = BackupSetting::query()->where('hospital_id', $hospitalId)->first();
        if (!$setting || $setting->retention === null) {
            return 30;
        }

        return max(1, (int) $setting->retention);
    }

    private function resolveHospitalId(Request $request): ?int
    {
        $user = $request->user();

        return $user && $user->role === 'super_admin'
            ? ($request->integer('hospital_id') ?: ($user->hospital_id ?? null))
            : ($user->hospital_id ?? null);
    }
}
