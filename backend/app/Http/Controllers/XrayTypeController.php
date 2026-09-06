<?php

namespace App\Http\Controllers;

use App\Models\XrayType;
use App\Http\Controllers\Concerns\StoresNamesInUpperCase;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * CRUD for the X-Ray study catalogue.
 *
 * Mirrors UltrasoundTypeController: same scoping, same per-hospital unique
 * name, same refusal to delete a study that already has receipts against it.
 */
class XrayTypeController extends Controller
{
    use StoresNamesInUpperCase;

    public function index(Request $request)
    {
        $user = $request->user();

        $query = XrayType::query();

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

        // No separate fee right here, unlike ultrasound: X-Ray receipts have
        // never had one either, so whoever may add a study may price it.
        // Introducing set_xray_fee would zero every price until it was granted.
        $data['created_by'] = $request->user()->name ?? null;
        $data['updated_by'] = $request->user()->name ?? null;

        return response()->json(XrayType::create($data), 201);
    }

    public function show(Request $request, XrayType $xrayType)
    {
        $this->authorizeScope($request->user(), $xrayType);

        return response()->json($xrayType);
    }

    public function update(Request $request, XrayType $xrayType)
    {
        $this->authorizeScope($request->user(), $xrayType);

        $hospitalId = (int) $xrayType->hospital_id;
        $data = $this->validatePayload($request, $hospitalId, $xrayType->id);

        $data['hospital_id'] = $hospitalId;
        $data['updated_by'] = $request->user()->name ?? null;

        $xrayType->update($data);

        return response()->json($xrayType->fresh());
    }

    public function destroy(Request $request, XrayType $xrayType)
    {
        $this->authorizeScope($request->user(), $xrayType);

        // Receipts keep their xray_type_id, so deleting a study that has been
        // billed would leave receipts pointing at nothing.
        if ($xrayType->receipts()->exists()) {
            return response()->json([
                'message' => 'This X-Ray type has receipts against it and cannot be deleted. Deactivate it instead.',
            ], 422);
        }

        $xrayType->delete();

        return response()->json(['message' => 'X-Ray type deleted']);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePayload(Request $request, int $hospitalId, ?int $typeId): array
    {
        return $this->upperCaseNames($request->validate([
            'name' => [
                'required',
                'string',
                'max:191',
                Rule::unique('xray_types', 'name')
                    ->where(fn ($q) => $q->where('hospital_id', $hospitalId)->whereNull('deleted_at'))
                    ->ignore($typeId),
            ],
            'code' => ['nullable', 'string', 'max:50'],
            'description' => ['nullable', 'string'],
            'price' => ['nullable', 'numeric', 'min:0'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]), ['name']);
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

    private function authorizeScope($user, XrayType $xrayType): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $xrayType->hospital_id) {
            abort(403, 'Unauthorized X-Ray type access');
        }
    }
}
