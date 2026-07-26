<?php

namespace App\Http\Controllers;

use App\Models\Employee;
use App\Models\EmployeeAttendance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class EmployeeAttendanceController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = EmployeeAttendance::query()->with([
            'employee:id,employee_code,first_name,last_name,department_id,shift_id',
            'employee.department:id,name',
            'shift:id,name,start_time,end_time',
        ]);

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->integer('employee_id'));
        }

        if ($request->filled('department_id')) {
            $departmentId = $request->integer('department_id');
            $query->whereHas('employee', fn ($q) => $q->where('department_id', $departmentId));
        }

        if ($request->filled('shift_id')) {
            $query->where('shift_id', $request->integer('shift_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('start_date')) {
            $query->whereDate('attendance_date', '>=', $request->string('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->whereDate('attendance_date', '<=', $request->string('end_date'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->whereHas('employee', function ($employeeQuery) use ($search) {
                $employeeQuery->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('employee_code', 'like', "%{$search}%");
            });
        }

        return response()->json($query->orderByDesc('attendance_date')->orderByDesc('id')->get());
    }

    public function store(Request $request)
    {
        $hospitalId = $this->resolveHospitalId($request);
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $this->validatePayload($request, null, $hospitalId);
        $this->ensureUniqueAttendance($hospitalId, (int) $data['employee_id'], (string) $data['attendance_date']);

        $employee = Employee::query()
            ->where('hospital_id', $hospitalId)
            ->findOrFail((int) $data['employee_id']);

        $data['hospital_id'] = $hospitalId;
        $data['shift_id'] = $data['shift_id'] ?? $employee->shift_id;
        $data['created_by'] = $request->user()->name ?? null;
        $data['updated_by'] = $request->user()->name ?? null;

        $attendance = EmployeeAttendance::create($data);

        return response()->json($attendance->load(['employee:id,employee_code,first_name,last_name,department_id,shift_id', 'employee.department:id,name', 'shift:id,name,start_time,end_time']), 201);
    }

    public function bulkStore(Request $request)
    {
        $this->normalizeRequestTimes($request, ['check_in_time', 'check_out_time']);
        $this->normalizeEntryTimes($request);

        $hospitalId = $this->resolveHospitalId($request);
        $payload = $request->validate([
            'hospital_id' => ['nullable', 'exists:hospitals,id'],
            'department_id' => ['nullable', Rule::exists('departments', 'id')->where(fn ($q) => $q->where('hospital_id', $hospitalId))],
            'employee_ids' => ['nullable', 'array'],
            'employee_ids.*' => [Rule::exists('employees', 'id')->where(fn ($q) => $q->where('hospital_id', $hospitalId))],
            'attendance_date' => ['required', 'date'],
            'shift_id' => ['nullable', Rule::exists('shifts', 'id')->where(fn ($q) => $q->where('hospital_id', $hospitalId))],
            'status' => ['nullable', 'in:present,absent,leave,half_day,holiday'],
            'check_in_time' => ['nullable', 'date_format:H:i'],
            'check_out_time' => ['nullable', 'date_format:H:i'],
            'notes' => ['nullable', 'string'],
            'entries' => ['nullable', 'array'],
            'entries.*.employee_id' => [Rule::exists('employees', 'id')->where(fn ($q) => $q->where('hospital_id', $hospitalId))],
            'entries.*.status' => ['nullable', 'in:present,absent,leave,half_day,holiday'],
            'entries.*.check_in_time' => ['nullable', 'date_format:H:i'],
            'entries.*.check_out_time' => ['nullable', 'date_format:H:i'],
            'entries.*.shift_id' => ['nullable', Rule::exists('shifts', 'id')->where(fn ($q) => $q->where('hospital_id', $hospitalId))],
            'entries.*.notes' => ['nullable', 'string'],
        ]);

        $attendanceDate = (string) $payload['attendance_date'];
        $defaultStatus = (string) ($payload['status'] ?? 'present');
        $defaultCheckIn = $this->normalizeTimeString($payload['check_in_time'] ?? null);
        $defaultCheckOut = $this->normalizeTimeString($payload['check_out_time'] ?? null);
        $defaultShiftId = isset($payload['shift_id']) ? (int) $payload['shift_id'] : null;
        $defaultNotes = $payload['notes'] ?? null;

        $this->validateTimeRange($defaultCheckIn, $defaultCheckOut);

        $entries = collect($payload['entries'] ?? []);
        $employeeIds = collect($payload['employee_ids'] ?? []);

        if ($entries->isNotEmpty()) {
            $employeeIds = $entries->pluck('employee_id');
        } elseif ($employeeIds->isEmpty() && !empty($payload['department_id'])) {
            $employeeIds = Employee::query()
                ->where('hospital_id', $hospitalId)
                ->where('department_id', (int) $payload['department_id'])
                ->where('status', 'active')
                ->pluck('id');
        }

        $employeeIds = $employeeIds->map(fn ($id) => (int) $id)->unique()->values();

        if ($employeeIds->isEmpty()) {
            throw ValidationException::withMessages([
                'employee_ids' => ['No employees found for bulk attendance. Select employees or a department with active employees.'],
            ]);
        }

        $employees = Employee::query()
            ->where('hospital_id', $hospitalId)
            ->whereIn('id', $employeeIds->all())
            ->get()
            ->keyBy('id');

        $upsertRows = [];

        foreach ($employeeIds as $employeeId) {
            $employee = $employees->get($employeeId);
            if (!$employee) {
                continue;
            }

            $entry = $entries->firstWhere('employee_id', $employeeId);
            $entryStatus = (string) ($entry['status'] ?? $defaultStatus);
            $entryCheckIn = $this->normalizeTimeString($entry['check_in_time'] ?? $defaultCheckIn);
            $entryCheckOut = $this->normalizeTimeString($entry['check_out_time'] ?? $defaultCheckOut);
            $entryShiftId = isset($entry['shift_id']) ? (int) $entry['shift_id'] : ($defaultShiftId ?? (int) ($employee->shift_id ?? 0) ?: null);
            $entryNotes = $entry['notes'] ?? $defaultNotes;

            $this->validateTimeRange($entryCheckIn, $entryCheckOut);

            $upsertRows[] = [
                'hospital_id' => $hospitalId,
                'employee_id' => $employeeId,
                'attendance_date' => $attendanceDate,
                'shift_id' => $entryShiftId,
                'check_in_time' => $entryCheckIn,
                'check_out_time' => $entryCheckOut,
                'status' => $entryStatus,
                'notes' => $entryNotes,
                'updated_by' => $request->user()->name ?? null,
                'updated_at' => now(),
                'created_by' => $request->user()->name ?? null,
                'created_at' => now(),
            ];
        }

        DB::transaction(function () use ($upsertRows) {
            EmployeeAttendance::query()->upsert(
                $upsertRows,
                ['hospital_id', 'employee_id', 'attendance_date'],
                ['shift_id', 'check_in_time', 'check_out_time', 'status', 'notes', 'updated_by', 'updated_at']
            );
        });

        $records = EmployeeAttendance::query()
            ->with(['employee:id,employee_code,first_name,last_name,department_id,shift_id', 'employee.department:id,name', 'shift:id,name,start_time,end_time'])
            ->where('hospital_id', $hospitalId)
            ->whereDate('attendance_date', $attendanceDate)
            ->whereIn('employee_id', $employeeIds->all())
            ->orderBy('employee_id')
            ->get();

        return response()->json([
            'message' => 'Bulk attendance saved successfully',
            'count' => $records->count(),
            'records' => $records,
        ]);
    }

    public function show(Request $request, EmployeeAttendance $employeeAttendance)
    {
        $this->authorizeScope($request->user(), $employeeAttendance);

        return response()->json($employeeAttendance->load(['employee:id,employee_code,first_name,last_name,department_id,shift_id', 'employee.department:id,name', 'shift:id,name,start_time,end_time']));
    }

    public function update(Request $request, EmployeeAttendance $employeeAttendance)
    {
        $this->authorizeScope($request->user(), $employeeAttendance);

        $hospitalId = (int) $employeeAttendance->hospital_id;
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $this->validatePayload($request, $employeeAttendance->id, $hospitalId);
        $this->ensureUniqueAttendance($hospitalId, (int) $data['employee_id'], (string) $data['attendance_date'], $employeeAttendance->id);

        $employee = Employee::query()
            ->where('hospital_id', $hospitalId)
            ->findOrFail((int) $data['employee_id']);

        $data['hospital_id'] = $hospitalId;
        $data['shift_id'] = $data['shift_id'] ?? $employee->shift_id;
        $data['updated_by'] = $request->user()->name ?? null;

        $employeeAttendance->update($data);

        return response()->json($employeeAttendance->fresh()->load(['employee:id,employee_code,first_name,last_name,department_id,shift_id', 'employee.department:id,name', 'shift:id,name,start_time,end_time']));
    }

    public function export(Request $request)
    {
        $hospitalId = $this->resolveHospitalId($request);

        $query = EmployeeAttendance::query()
            ->with(['employee:id,employee_code,first_name,last_name,department_id', 'employee.department:id,name', 'shift:id,name'])
            ->where('hospital_id', $hospitalId)
            ->orderByDesc('attendance_date')
            ->orderByDesc('id');

        if ($request->filled('department_id')) {
            $departmentId = $request->integer('department_id');
            $query->whereHas('employee', fn ($q) => $q->where('department_id', $departmentId));
        }

        if ($request->filled('start_date')) {
            $query->whereDate('attendance_date', '>=', $request->string('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->whereDate('attendance_date', '<=', $request->string('end_date'));
        }

        $filename = 'employee_attendance_' . now()->format('Ymd_His') . '.csv';

        return response()->streamDownload(function () use ($query) {
            $output = fopen('php://output', 'w');
            fputcsv($output, [
                'attendance_date',
                'employee_code',
                'employee_name',
                'department',
                'shift',
                'status',
                'check_in_time',
                'check_out_time',
                'notes',
            ]);

            $query->chunk(500, function ($rows) use ($output) {
                foreach ($rows as $row) {
                    fputcsv($output, [
                        (string) $row->attendance_date,
                        (string) ($row->employee?->employee_code ?? ''),
                        trim((string) (($row->employee?->first_name ?? '') . ' ' . ($row->employee?->last_name ?? ''))),
                        (string) ($row->employee?->department?->name ?? ''),
                        (string) ($row->shift?->name ?? ''),
                        (string) ($row->status ?? ''),
                        (string) ($row->check_in_time ?? ''),
                        (string) ($row->check_out_time ?? ''),
                        (string) ($row->notes ?? ''),
                    ]);
                }
            });

            fclose($output);
        }, $filename, [
            'Content-Type' => 'text/csv',
        ]);
    }

    public function import(Request $request)
    {
        $hospitalId = $this->resolveHospitalId($request);

        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt'],
        ]);

        $file = $request->file('file');
        $rows = [];

        if (($handle = fopen($file->getRealPath(), 'r')) !== false) {
            $headers = fgetcsv($handle);

            if (!$headers || count($headers) === 0) {
                throw ValidationException::withMessages([
                    'file' => ['CSV file is empty or invalid.'],
                ]);
            }

            $normalizedHeaders = array_map(fn ($h) => strtolower(trim((string) $h)), $headers);

            while (($data = fgetcsv($handle)) !== false) {
                if (count(array_filter($data, fn ($v) => trim((string) $v) !== '')) === 0) {
                    continue;
                }

                $row = [];
                foreach ($normalizedHeaders as $idx => $header) {
                    $row[$header] = $data[$idx] ?? null;
                }
                $rows[] = $row;
            }

            fclose($handle);
        }

        if (empty($rows)) {
            throw ValidationException::withMessages([
                'file' => ['No import rows found in file.'],
            ]);
        }

        $success = 0;
        $failed = 0;
        $errors = [];

        DB::transaction(function () use ($rows, $hospitalId, $request, &$success, &$failed, &$errors) {
            foreach ($rows as $index => $row) {
                try {
                    $employeeCode = trim((string) ($row['employee_code'] ?? ''));
                    $attendanceDate = trim((string) ($row['attendance_date'] ?? ''));
                    $status = trim((string) ($row['status'] ?? 'present'));
                    $checkIn = $this->normalizeTimeString($row['check_in_time'] ?? null);
                    $checkOut = $this->normalizeTimeString($row['check_out_time'] ?? null);
                    $notes = trim((string) ($row['notes'] ?? ''));
                    $shiftName = trim((string) ($row['shift'] ?? ''));

                    if ($employeeCode === '' || $attendanceDate === '') {
                        throw ValidationException::withMessages([
                            'row' => ['employee_code and attendance_date are required.'],
                        ]);
                    }

                    $employee = Employee::query()
                        ->where('hospital_id', $hospitalId)
                        ->where('employee_code', $employeeCode)
                        ->first();

                    if (!$employee) {
                        throw ValidationException::withMessages([
                            'row' => ["Employee not found for code: {$employeeCode}"],
                        ]);
                    }

                    $shiftId = null;
                    if ($shiftName !== '') {
                        $shift = DB::table('shifts')
                            ->where('hospital_id', $hospitalId)
                            ->where('name', $shiftName)
                            ->first();
                        $shiftId = $shift?->id;
                    }

                    $this->validateTimeRange($checkIn, $checkOut);

                    EmployeeAttendance::query()->updateOrCreate(
                        [
                            'hospital_id' => $hospitalId,
                            'employee_id' => (int) $employee->id,
                            'attendance_date' => $attendanceDate,
                        ],
                        [
                            'shift_id' => $shiftId ?: $employee->shift_id,
                            'status' => $status,
                            'check_in_time' => $checkIn,
                            'check_out_time' => $checkOut,
                            'notes' => $notes !== '' ? $notes : null,
                            'updated_by' => $request->user()->name ?? null,
                            'created_by' => $request->user()->name ?? null,
                        ]
                    );

                    $success++;
                } catch (\Throwable $e) {
                    $failed++;
                    $errors[] = [
                        'row' => $index + 2,
                        'message' => $e->getMessage(),
                    ];
                }
            }
        });

        return response()->json([
            'message' => 'Attendance import processed.',
            'success' => $success,
            'failed' => $failed,
            'errors' => $errors,
        ]);
    }

    public function destroy(Request $request, EmployeeAttendance $employeeAttendance)
    {
        $this->authorizeScope($request->user(), $employeeAttendance);

        $employeeAttendance->delete();

        return response()->json(['message' => 'Attendance deleted']);
    }

    private function validatePayload(Request $request, ?int $attendanceId = null, ?int $defaultHospitalId = null): array
    {
        $this->normalizeRequestTimes($request, ['check_in_time', 'check_out_time']);

        $hospitalId = $defaultHospitalId ?: $this->resolveHospitalId($request);

        $data = $request->validate([
            'hospital_id' => ['required', 'exists:hospitals,id'],
            'employee_id' => [
                'required',
                Rule::exists('employees', 'id')->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
            ],
            'shift_id' => [
                'nullable',
                Rule::exists('shifts', 'id')->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
            ],
            'attendance_date' => ['required', 'date'],
            'check_in_time' => ['nullable', 'date_format:H:i'],
            'check_out_time' => ['nullable', 'date_format:H:i'],
            'status' => ['required', 'in:present,absent,leave,half_day,holiday'],
            'notes' => ['nullable', 'string'],
        ]);

        $data['check_in_time'] = $this->normalizeTimeString($data['check_in_time'] ?? null);
        $data['check_out_time'] = $this->normalizeTimeString($data['check_out_time'] ?? null);

        $this->validateTimeRange($data['check_in_time'], $data['check_out_time']);

        return $data;
    }

    private function normalizeRequestTimes(Request $request, array $fields): void
    {
        foreach ($fields as $field) {
            if (!$request->exists($field)) {
                continue;
            }

            $request->merge([
                $field => $this->normalizeTimeString($request->input($field)),
            ]);
        }
    }

    private function normalizeEntryTimes(Request $request): void
    {
        $entries = $request->input('entries');
        if (!is_array($entries)) {
            return;
        }

        $normalizedEntries = array_map(function ($entry) {
            if (!is_array($entry)) {
                return $entry;
            }

            if (array_key_exists('check_in_time', $entry)) {
                $entry['check_in_time'] = $this->normalizeTimeString($entry['check_in_time']);
            }

            if (array_key_exists('check_out_time', $entry)) {
                $entry['check_out_time'] = $this->normalizeTimeString($entry['check_out_time']);
            }

            return $entry;
        }, $entries);

        $request->merge(['entries' => $normalizedEntries]);
    }

    private function normalizeTimeString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $time = trim((string) $value);

        if ($time === '') {
            return null;
        }

        if (preg_match('/^\d{2}:\d{2}:\d{2}$/', $time)) {
            return substr($time, 0, 5);
        }

        return $time;
    }

    private function ensureUniqueAttendance(int $hospitalId, int $employeeId, string $attendanceDate, ?int $ignoreId = null): void
    {
        $query = EmployeeAttendance::query()
            ->where('hospital_id', $hospitalId)
            ->where('employee_id', $employeeId)
            ->whereDate('attendance_date', $attendanceDate);

        if ($ignoreId) {
            $query->where('id', '!=', $ignoreId);
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'attendance_date' => ['Attendance already exists for this employee on the selected date.'],
            ]);
        }
    }

    private function validateTimeRange(?string $checkIn, ?string $checkOut): void
    {
        if (!empty($checkIn) && !empty($checkOut) && $checkOut < $checkIn) {
            throw ValidationException::withMessages([
                'check_out_time' => ['Check-out time must be after check-in time.'],
            ]);
        }
    }

    private function resolveHospitalId(Request $request, ?int $fallbackHospitalId = null): int
    {
        if ($request->user()->role !== 'super_admin') {
            $tenantHospitalId = (int) ($fallbackHospitalId ?: $request->user()->hospital_id);

            if ($tenantHospitalId <= 0) {
                abort(422, 'Hospital tenant context is required for this user.');
            }

            return $tenantHospitalId;
        }

        $hospitalId = $request->integer('hospital_id') ?: $fallbackHospitalId;

        if (!$hospitalId) {
            abort(422, 'The hospital_id field is required.');
        }

        return (int) $hospitalId;
    }

    private function authorizeScope($user, EmployeeAttendance $employeeAttendance): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $employeeAttendance->hospital_id) {
            abort(403, 'Unauthorized attendance access');
        }
    }
}
