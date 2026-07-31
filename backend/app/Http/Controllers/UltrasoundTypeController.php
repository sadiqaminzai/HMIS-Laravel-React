<?php

namespace App\Http\Controllers;

use App\Models\UltrasoundType;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UltrasoundTypeController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = UltrasoundType::query();

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->boolean('active_only')) {
            $query->where('is_active', true);
        }

        return response()->json(
            $query->orderBy('sort_order')->orderBy('name')->get()
        );
    }

    public function store(Request $request)
    {
        $hospitalId = $this->resolveHospitalId($request);
        $data = $this->validatePayload($request, $hospitalId, null);

        $data['hospital_id'] = $hospitalId;
        $data['created_by'] = $request->user()->name ?? null;
        $data['updated_by'] = $request->user()->name ?? null;

        $type = UltrasoundType::create($data);

        return response()->json($type, 201);
    }

    public function show(Request $request, UltrasoundType $ultrasoundType)
    {
        $this->authorizeScope($request->user(), $ultrasoundType);

        return response()->json($ultrasoundType);
    }

    public function update(Request $request, UltrasoundType $ultrasoundType)
    {
        $this->authorizeScope($request->user(), $ultrasoundType);

        $hospitalId = (int) $ultrasoundType->hospital_id;
        $data = $this->validatePayload($request, $hospitalId, $ultrasoundType->id);

        $data['hospital_id'] = $hospitalId;
        $data['updated_by'] = $request->user()->name ?? null;

        $ultrasoundType->update($data);

        return response()->json($ultrasoundType->fresh());
    }

    public function destroy(Request $request, UltrasoundType $ultrasoundType)
    {
        $this->authorizeScope($request->user(), $ultrasoundType);

        if ($ultrasoundType->exams()->exists()) {
            return response()->json([
                'message' => 'This ultrasound type has recorded exams and cannot be deleted. Deactivate it instead.',
            ], 422);
        }

        $ultrasoundType->delete();

        return response()->json(['message' => 'Ultrasound type deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePayload(Request $request, int $hospitalId, ?int $typeId): array
    {
        return $request->validate([
            'name' => [
                'required',
                'string',
                'max:191',
                Rule::unique('ultrasound_types', 'name')
                    ->where(fn ($q) => $q->where('hospital_id', $hospitalId)->whereNull('deleted_at'))
                    ->ignore($typeId),
            ],
            'code' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
            'default_template' => ['nullable', 'string'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);
    }

    private function resolveHospitalId(Request $request): int
    {
        if ($request->user()->role !== 'super_admin') {
            $hospitalId = (int) $request->user()->hospital_id;

            if ($hospitalId <= 0) {
                abort(422, 'Hospital tenant context is required for this user.');
            }

            return $hospitalId;
        }

        $hospitalId = $request->integer('hospital_id');

        if (!$hospitalId) {
            abort(422, 'The hospital_id field is required.');
        }

        return (int) $hospitalId;
    }

    private function authorizeScope($user, UltrasoundType $ultrasoundType): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $ultrasoundType->hospital_id) {
            abort(403, 'Unauthorized ultrasound type access');
        }
    }
}
