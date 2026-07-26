<?php

namespace App\Http\Controllers;

use App\Models\LeaveRequest;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class LeaveRequestController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = LeaveRequest::query()->with([
            'employee:id,employee_code,first_name,last_name',
            'approvedBy:id,name',
        ]);

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('employee_id')) {
            $query->where('employee_id', $request->integer('employee_id'));
        }

        if ($request->filled('leave_type')) {
            $query->where('leave_type', $request->string('leave_type'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('start_date')) {
            $query->whereDate('start_date', '>=', $request->string('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->whereDate('end_date', '<=', $request->string('end_date'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->whereHas('employee', function ($employeeQuery) use ($search) {
                $employeeQuery->where('first_name', 'like', "%{$search}%")
                    ->orWhere('last_name', 'like', "%{$search}%")
                    ->orWhere('employee_code', 'like', "%{$search}%");
            });
        }

        return response()->json($query->orderByDesc('start_date')->orderByDesc('id')->get());
    }

    public function store(Request $request)
    {
        $hospitalId = $this->resolveHospitalId($request);
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $this->validatePayload($request, null, $hospitalId);
        $this->ensureNoDateOverlap((int) $data['employee_id'], (string) $data['start_date'], (string) $data['end_date']);

        $data['hospital_id'] = $hospitalId;
        $data['total_days'] = $this->resolveTotalDays((string) $data['start_date'], (string) $data['end_date'], $data['total_days'] ?? null);
        $data['status'] = 'pending';
        $data['approved_by_user_id'] = null;
        $data['approved_at'] = null;
        $data['rejection_reason'] = null;
        $data['created_by'] = $request->user()->name ?? null;
        $data['updated_by'] = $request->user()->name ?? null;

        $leaveRequest = LeaveRequest::create($data);

        return response()->json($leaveRequest->load(['employee:id,employee_code,first_name,last_name', 'approvedBy:id,name']), 201);
    }

    public function show(Request $request, LeaveRequest $leaveRequest)
    {
        $this->authorizeScope($request->user(), $leaveRequest);

        return response()->json($leaveRequest->load(['employee:id,employee_code,first_name,last_name', 'approvedBy:id,name']));
    }

    public function update(Request $request, LeaveRequest $leaveRequest)
    {
        $this->authorizeScope($request->user(), $leaveRequest);

        if ($leaveRequest->status !== 'pending') {
            abort(422, 'Only pending leave requests can be edited.');
        }

        $hospitalId = (int) $leaveRequest->hospital_id;
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $this->validatePayload($request, $leaveRequest->id, $hospitalId);
        $this->ensureNoDateOverlap((int) $data['employee_id'], (string) $data['start_date'], (string) $data['end_date'], $leaveRequest->id);

        if ($request->filled('status') && (string) $request->string('status') !== 'pending') {
            throw ValidationException::withMessages([
                'status' => ['Use approve/reject/cancel actions to change leave status.'],
            ]);
        }

        $data['hospital_id'] = $hospitalId;
        $data['total_days'] = $this->resolveTotalDays((string) $data['start_date'], (string) $data['end_date'], $data['total_days'] ?? null);
        $data['updated_by'] = $request->user()->name ?? null;

        unset($data['status']);
        unset($data['approved_by_user_id']);
        unset($data['approved_at']);
        unset($data['rejection_reason']);

        $leaveRequest->update($data);

        return response()->json($leaveRequest->fresh()->load(['employee:id,employee_code,first_name,last_name', 'approvedBy:id,name']));
    }

    public function approve(Request $request, LeaveRequest $leaveRequest)
    {
        $this->authorizeScope($request->user(), $leaveRequest);

        if ($leaveRequest->status !== 'pending') {
            abort(422, 'Only pending leave requests can be approved.');
        }

        $leaveRequest->update([
            'status' => 'approved',
            'approved_by_user_id' => $request->user()->id,
            'approved_at' => now(),
            'rejection_reason' => null,
            'updated_by' => $request->user()->name ?? null,
        ]);

        return response()->json($leaveRequest->fresh()->load(['employee:id,employee_code,first_name,last_name', 'approvedBy:id,name']));
    }

    public function reject(Request $request, LeaveRequest $leaveRequest)
    {
        $this->authorizeScope($request->user(), $leaveRequest);

        if ($leaveRequest->status !== 'pending') {
            abort(422, 'Only pending leave requests can be rejected.');
        }

        $data = $request->validate([
            'rejection_reason' => ['nullable', 'string'],
        ]);

        $leaveRequest->update([
            'status' => 'rejected',
            'approved_by_user_id' => $request->user()->id,
            'approved_at' => now(),
            'rejection_reason' => $data['rejection_reason'] ?? null,
            'updated_by' => $request->user()->name ?? null,
        ]);

        return response()->json($leaveRequest->fresh()->load(['employee:id,employee_code,first_name,last_name', 'approvedBy:id,name']));
    }

    public function cancel(Request $request, LeaveRequest $leaveRequest)
    {
        $this->authorizeScope($request->user(), $leaveRequest);

        if (!in_array($leaveRequest->status, ['pending', 'approved'], true)) {
            abort(422, 'Only pending or approved leave requests can be cancelled.');
        }

        $leaveRequest->update([
            'status' => 'cancelled',
            'updated_by' => $request->user()->name ?? null,
        ]);

        return response()->json($leaveRequest->fresh()->load(['employee:id,employee_code,first_name,last_name', 'approvedBy:id,name']));
    }

    public function destroy(Request $request, LeaveRequest $leaveRequest)
    {
        $this->authorizeScope($request->user(), $leaveRequest);

        if ($leaveRequest->status === 'approved') {
            abort(422, 'Approved leave requests cannot be deleted. Cancel it instead.');
        }

        $leaveRequest->delete();

        return response()->json(['message' => 'Leave request deleted']);
    }

    private function validatePayload(Request $request, ?int $leaveRequestId = null, ?int $defaultHospitalId = null): array
    {
        $hospitalId = $defaultHospitalId ?: $this->resolveHospitalId($request);

        $data = $request->validate([
            'hospital_id' => ['required', 'exists:hospitals,id'],
            'employee_id' => [
                'required',
                Rule::exists('employees', 'id')->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
            ],
            'leave_type' => ['required', 'in:annual,sick,casual,unpaid,other'],
            'start_date' => ['required', 'date'],
            'end_date' => ['required', 'date', 'after_or_equal:start_date'],
            'total_days' => ['nullable', 'numeric', 'min:0.5'],
            'reason' => ['nullable', 'string'],
            'status' => ['nullable', 'in:pending,approved,rejected,cancelled'],
        ]);

        return $data;
    }

    private function resolveTotalDays(string $startDate, string $endDate, mixed $manualTotalDays = null): float
    {
        if ($manualTotalDays !== null) {
            return max(0.5, (float) $manualTotalDays);
        }

        $start = Carbon::parse($startDate)->startOfDay();
        $end = Carbon::parse($endDate)->startOfDay();

        return (float) ($start->diffInDays($end) + 1);
    }

    private function ensureNoDateOverlap(int $employeeId, string $startDate, string $endDate, ?int $ignoreId = null): void
    {
        $query = LeaveRequest::query()
            ->where('employee_id', $employeeId)
            ->whereIn('status', ['pending', 'approved'])
            ->whereDate('start_date', '<=', $endDate)
            ->whereDate('end_date', '>=', $startDate);

        if ($ignoreId) {
            $query->where('id', '!=', $ignoreId);
        }

        if ($query->exists()) {
            throw ValidationException::withMessages([
                'start_date' => ['Leave dates overlap with an existing pending/approved request.'],
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

    private function authorizeScope($user, LeaveRequest $leaveRequest): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $leaveRequest->hospital_id) {
            abort(403, 'Unauthorized leave request access');
        }
    }
}
