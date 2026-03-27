<?php

namespace App\Http\Controllers;

use App\Models\SurgeryType;
use App\Services\SurgeryService;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class SurgeryTypeController extends Controller
{
    public function __construct(private readonly SurgeryService $surgeryService)
    {
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $query = SurgeryType::query()->where('is_delete', false);

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where('name', 'like', "%{$search}%");
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        return response()->json($query->orderByDesc('id')->paginate($request->integer('per_page', 25)));
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);
        $data['created_by'] = $request->user()?->name;

        $surgeryType = SurgeryType::create($data);

        return response()->json($surgeryType, 201);
    }

    public function show(Request $request, SurgeryType $surgeryType)
    {
        $this->authorizeScope($request->user(), $surgeryType->hospital_id);

        return response()->json($surgeryType);
    }

    public function update(Request $request, SurgeryType $surgeryType)
    {
        $this->authorizeScope($request->user(), $surgeryType->hospital_id);

        $data = $this->validatePayload($request, $surgeryType->id, $surgeryType->hospital_id);
        $data['updated_by'] = $request->user()?->name;

        $surgeryType->update($data);

        return response()->json($surgeryType->fresh());
    }

    public function destroy(Request $request, SurgeryType $surgeryType)
    {
        $this->authorizeScope($request->user(), $surgeryType->hospital_id);
        $this->surgeryService->assertTypeDeletable($surgeryType);

        $surgeryType->update([
            'is_delete' => true,
            'is_active' => false,
            'deleted_by' => $request->user()?->name,
        ]);

        return response()->json(['message' => 'Surgery type deleted']);
    }

    private function validatePayload(Request $request, ?int $id = null, ?int $existingHospitalId = null): array
    {
        $hospitalId = $request->user()->role === 'super_admin'
            ? ($request->integer('hospital_id') ?: $existingHospitalId)
            : $request->user()->hospital_id;

        return $request->validate([
            'hospital_id' => [
                $request->user()->role === 'super_admin' ? 'required' : 'nullable',
                'exists:hospitals,id',
            ],
            'name' => [
                'required',
                'string',
                'max:191',
                Rule::unique('surgery_types', 'name')
                    ->where(fn ($q) => $q->where('hospital_id', $hospitalId)->where('is_delete', false))
                    ->ignore($id),
            ],
            'description' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);
    }

    private function authorizeScope($user, int $hospitalId): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $hospitalId) {
            abort(403, 'Unauthorized access');
        }
    }
}
