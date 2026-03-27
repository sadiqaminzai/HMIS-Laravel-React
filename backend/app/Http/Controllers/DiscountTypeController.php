<?php

namespace App\Http\Controllers;

use App\Models\DiscountType;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DiscountTypeController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = DiscountType::query()->where('is_delete', false);

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

        $discountType = DiscountType::create($data);

        return response()->json($discountType, 201);
    }

    public function show(Request $request, DiscountType $discountType)
    {
        $this->authorizeScope($request->user(), $discountType->hospital_id);

        return response()->json($discountType);
    }

    public function update(Request $request, DiscountType $discountType)
    {
        $this->authorizeScope($request->user(), $discountType->hospital_id);

        $data = $this->validatePayload($request, $discountType->id, $discountType->hospital_id);
        $data['updated_by'] = $request->user()?->name;

        $discountType->update($data);

        return response()->json($discountType->fresh());
    }

    public function destroy(Request $request, DiscountType $discountType)
    {
        $this->authorizeScope($request->user(), $discountType->hospital_id);

        $discountType->update([
            'is_delete' => true,
            'is_active' => false,
            'deleted_by' => $request->user()?->name,
        ]);

        return response()->json(['message' => 'Discount type deleted']);
    }

    private function validatePayload(Request $request, ?int $id = null, ?int $existingHospitalId = null): array
    {
        $hospitalId = $request->user()->role === 'super_admin'
            ? ($request->integer('hospital_id') ?: $existingHospitalId)
            : $request->user()->hospital_id;

        return $request->validate([
            'hospital_id' => [
                Rule::requiredIf(fn () => $request->user()->role === 'super_admin'),
                'nullable',
                'exists:hospitals,id',
            ],
            'name' => [
                'required',
                'string',
                'max:191',
                Rule::unique('discount_types', 'name')
                    ->where(fn ($q) => $q->where('hospital_id', $hospitalId)->where('is_delete', false))
                    ->ignore($id),
            ],
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
