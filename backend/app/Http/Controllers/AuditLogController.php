<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AuditLogController extends Controller
{
    /**
     * Actions the client may report for events that happen outside the API
     * (printing a document, exporting a grid).
     */
    private const CLIENT_ACTIONS = ['print', 'export', 'view'];

    public function index(Request $request)
    {
        $query = $this->scopedQuery($request);

        $perPage = min(max((int) $request->integer('per_page', 25), 1), 200);

        return response()->json(
            $query->orderByDesc('created_at')
                ->orderByDesc('id')
                ->paginate($perPage)
                ->appends($request->query())
        );
    }

    public function show(Request $request, AuditLog $auditLog)
    {
        $this->authorizeScope($request->user(), $auditLog);

        return response()->json($auditLog->load('user:id,name,email'));
    }

    /**
     * Distinct values used to populate the filter dropdowns.
     */
    public function filters(Request $request)
    {
        $base = fn () => $this->scopedQuery($request, false);

        return response()->json([
            'modules' => $base()->select('module')->distinct()->orderBy('module')->pluck('module'),
            'actions' => $base()->select('action')->distinct()->orderBy('action')->pluck('action'),
            'users' => $base()
                ->select('user_id', 'user_name')
                ->whereNotNull('user_id')
                ->distinct()
                ->orderBy('user_name')
                ->get()
                ->map(fn ($row) => [
                    'id' => (string) $row->user_id,
                    'name' => $row->user_name,
                ])
                ->values(),
        ]);
    }

    /**
     * Unpaginated feed for Excel/PDF export on the client.
     */
    public function export(Request $request)
    {
        $rows = $this->scopedQuery($request)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit(10000)
            ->get();

        AuditLogger::log([
            'module' => 'Audit Log',
            'action' => 'export',
            'description' => 'Exported '.$rows->count().' audit log entries.',
        ]);

        return response()->json($rows);
    }

    /**
     * Record a client-side activity (print / export) that the API cannot observe.
     */
    public function storeClientEvent(Request $request)
    {
        $data = $request->validate([
            'module' => ['required', 'string', 'max:100'],
            'action' => ['required', 'string', Rule::in(self::CLIENT_ACTIONS)],
            'record_id' => ['nullable', 'string', 'max:100'],
            'record_label' => ['nullable', 'string', 'max:191'],
            'description' => ['nullable', 'string', 'max:1000'],
        ]);

        AuditLogger::log($data);

        return response()->json(['message' => 'Recorded'], 201);
    }

    /**
     * Base query with tenant scoping and every supported filter applied.
     */
    private function scopedQuery(Request $request, bool $applyFilters = true)
    {
        $user = $request->user();

        $query = AuditLog::query();

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if (!$applyFilters) {
            return $query;
        }

        if ($request->filled('module')) {
            $query->where('module', $request->string('module'));
        }

        if ($request->filled('action')) {
            $query->where('action', $request->string('action'));
        }

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->integer('user_id'));
        }

        if ($request->filled('start_date')) {
            $query->whereDate('created_at', '>=', $request->string('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->whereDate('created_at', '<=', $request->string('end_date'));
        }

        if ($request->filled('search')) {
            $term = '%'.$request->string('search').'%';
            $query->where(function ($q) use ($term) {
                $q->where('user_name', 'like', $term)
                    ->orWhere('module', 'like', $term)
                    ->orWhere('action', 'like', $term)
                    ->orWhere('record_id', 'like', $term)
                    ->orWhere('record_label', 'like', $term)
                    ->orWhere('description', 'like', $term)
                    ->orWhere('ip_address', 'like', $term);
            });
        }

        return $query;
    }

    private function authorizeScope($user, AuditLog $auditLog): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $auditLog->hospital_id) {
            abort(403, 'Unauthorized audit log access');
        }
    }
}
