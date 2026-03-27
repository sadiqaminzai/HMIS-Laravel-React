<?php

namespace App\Http\Controllers;

use App\Models\Surgery;
use App\Models\SurgeryType;
use App\Services\SurgeryService;
use Illuminate\Http\Request;

class SurgeryController extends Controller
{
    public function __construct(private readonly SurgeryService $surgeryService)
    {
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $query = Surgery::query()
            ->with('type:id,name')
            ->where('is_delete', false);

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('id_from')) {
            $query->where('id', '>=', $request->integer('id_from'));
        }

        if ($request->filled('id_to')) {
            $query->where('id', '<=', $request->integer('id_to'));
        }

        if ($request->filled('type_id')) {
            $query->where('type_id', $request->integer('type_id'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where('name', 'like', "%{$search}%");
        }

        return response()->json($query->orderByDesc('id')->paginate($request->integer('per_page', 25)));
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);
        $data['created_by'] = $request->user()?->name;

        $this->assertTypeScope((int) $data['type_id'], (int) $data['hospital_id']);

        $surgery = Surgery::create($data);

        return response()->json($surgery->load('type:id,name'), 201);
    }

    public function show(Request $request, Surgery $surgery)
    {
        $this->authorizeScope($request->user(), $surgery->hospital_id);

        return response()->json($surgery->load('type:id,name'));
    }

    public function update(Request $request, Surgery $surgery)
    {
        $this->authorizeScope($request->user(), $surgery->hospital_id);

        $data = $this->validatePayload($request, $surgery->hospital_id);
        $data['updated_by'] = $request->user()?->name;

        $this->assertTypeScope((int) $data['type_id'], (int) $data['hospital_id']);

        $surgery->update($data);

        return response()->json($surgery->fresh()->load('type:id,name'));
    }

    public function destroy(Request $request, Surgery $surgery)
    {
        $this->authorizeScope($request->user(), $surgery->hospital_id);
        $this->surgeryService->assertSurgeryDeletable($surgery);

        $surgery->update([
            'is_delete' => true,
            'is_active' => false,
            'deleted_by' => $request->user()?->name,
        ]);

        return response()->json(['message' => 'Surgery deleted']);
    }

    private function validatePayload(Request $request, ?int $existingHospitalId = null): array
    {
        $hospitalId = $request->user()->role === 'super_admin'
            ? ($request->integer('hospital_id') ?: $existingHospitalId)
            : $request->user()->hospital_id;

        $data = $request->validate([
            'hospital_id' => [
                $request->user()->role === 'super_admin' ? 'required' : 'nullable',
                'exists:hospitals,id',
            ],
            'name' => ['required', 'string', 'max:191'],
            'type_id' => ['required', 'exists:surgery_types,id'],
            'cost' => ['required', 'numeric', 'min:0'],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        } elseif (!isset($data['hospital_id'])) {
            $data['hospital_id'] = $hospitalId;
        }

        return $data;
    }

    private function assertTypeScope(int $typeId, int $hospitalId): void
    {
        $type = SurgeryType::query()
            ->where('id', $typeId)
            ->where('hospital_id', $hospitalId)
            ->where('is_delete', false)
            ->first();

        if (!$type) {
            abort(422, 'Surgery type does not belong to selected hospital');
        }
    }

    private function authorizeScope($user, int $hospitalId): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $hospitalId) {
            abort(403, 'Unauthorized access');
        }
    }
}
