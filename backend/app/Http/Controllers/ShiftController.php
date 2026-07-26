<?php

namespace App\Http\Controllers;

use App\Models\Shift;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ShiftController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Shift::query();

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        return response()->json($query->orderBy('start_time')->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $hospitalId = $this->resolveHospitalId($request);
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $this->validatePayload($request, null, $hospitalId);
        $data['hospital_id'] = $hospitalId;
        $data['created_by'] = $request->user()->name ?? null;
        $data['updated_by'] = $request->user()->name ?? null;
        $data['is_overnight'] = $this->isOvernight((string) $data['start_time'], (string) $data['end_time']);

        $shift = Shift::create($data);

        return response()->json($shift, 201);
    }

    public function show(Request $request, Shift $shift)
    {
        $this->authorizeScope($request->user(), $shift);

        return response()->json($shift);
    }

    public function update(Request $request, Shift $shift)
    {
        $this->authorizeScope($request->user(), $shift);

        $hospitalId = (int) $shift->hospital_id;
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $this->validatePayload($request, (int) $shift->id, $hospitalId);
        $data['hospital_id'] = $hospitalId;
        $data['updated_by'] = $request->user()->name ?? null;
        $data['is_overnight'] = $this->isOvernight((string) $data['start_time'], (string) $data['end_time']);

        $shift->update($data);

        return response()->json($shift->fresh());
    }

    public function destroy(Request $request, Shift $shift)
    {
        $this->authorizeScope($request->user(), $shift);

        $shift->delete();

        return response()->json(['message' => 'Shift deleted']);
    }

    private function validatePayload(Request $request, ?int $shiftId = null, ?int $defaultHospitalId = null): array
    {
        $this->normalizeRequestTimes($request, ['start_time', 'end_time']);

        $hospitalId = $defaultHospitalId ?: $this->resolveHospitalId($request);

        return $request->validate([
            'hospital_id' => ['required', 'exists:hospitals,id'],
            'name' => [
                'required',
                'string',
                'max:150',
                Rule::unique('shifts', 'name')
                    ->ignore($shiftId)
                    ->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
            ],
            'code' => [
                'nullable',
                'string',
                'max:50',
                Rule::unique('shifts', 'code')
                    ->ignore($shiftId)
                    ->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
            ],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i'],
            'grace_minutes' => ['nullable', 'integer', 'min:0', 'max:240'],
            'status' => ['required', 'in:active,inactive'],
            'description' => ['nullable', 'string'],
        ]);
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

    private function isOvernight(string $startTime, string $endTime): bool
    {
        return strcmp($endTime, $startTime) < 0;
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

    private function authorizeScope($user, Shift $shift): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $shift->hospital_id) {
            abort(403, 'Unauthorized shift access');
        }
    }
}
