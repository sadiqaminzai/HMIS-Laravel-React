<?php

namespace App\Http\Controllers;

use App\Models\EcgService;
use App\Http\Controllers\Concerns\StoresNamesInUpperCase;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

/**
 * CRUD for the ECG study catalogue.
 *
 * Mirrors DentalServiceController: same scoping, same per-hospital unique
 * name, same refusal to delete a study that already has receipts against it.
 *
 * The list ships empty. Every hospital enters its own studies -- English name,
 * description in the hospital's own wording, and a price -- and edits them
 * here rather than having a price list baked into the system.
 */
class EcgServiceController extends Controller
{
    use StoresNamesInUpperCase;

    public function index(Request $request)
    {
        $user = $request->user();

        $query = EcgService::query();

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

        // No separate fee right: whoever may add a service may price it, as
        // on the X-Ray desk. A dedicated right would zero every price until
        // it had been granted to somebody.
        $data['created_by'] = $request->user()->name ?? null;
        $data['updated_by'] = $request->user()->name ?? null;

        return response()->json(EcgService::create($data), 201);
    }

    public function show(Request $request, EcgService $ecgService)
    {
        $this->authorizeScope($request->user(), $ecgService);

        return response()->json($ecgService);
    }

    public function update(Request $request, EcgService $ecgService)
    {
        $this->authorizeScope($request->user(), $ecgService);

        $hospitalId = (int) $ecgService->hospital_id;
        $data = $this->validatePayload($request, $hospitalId, $ecgService->id);

        $data['hospital_id'] = $hospitalId;
        $data['updated_by'] = $request->user()->name ?? null;

        $ecgService->update($data);

        return response()->json($ecgService->fresh());
    }

    public function destroy(Request $request, EcgService $ecgService)
    {
        $this->authorizeScope($request->user(), $ecgService);

        // Receipts keep their ecg_service_id, so deleting a study that
        // has been billed would leave receipts pointing at nothing.
        if ($ecgService->receipts()->exists()) {
            return response()->json([
                'message' => 'This ECG study has receipts against it and cannot be deleted. Deactivate it instead.',
            ], 422);
        }

        $ecgService->delete();

        return response()->json(['message' => 'ECG study deleted']);
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
                Rule::unique('ecg_services', 'name')
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

    private function authorizeScope($user, EcgService $ecgService): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $ecgService->hospital_id) {
            abort(403, 'Unauthorized ECG study access');
        }
    }
}
