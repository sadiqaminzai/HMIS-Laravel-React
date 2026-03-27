<?php

namespace App\Http\Controllers;

use App\Models\Discount;
use App\Models\DiscountType;
use Illuminate\Http\Request;

class DiscountController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Discount::query()
            ->with('type:id,name')
            ->where('is_delete', false);

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('discount_type_id')) {
            $query->where('discount_type_id', $request->integer('discount_type_id'));
        }

        if ($request->filled('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
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

        $this->assertTypeScope((int) $data['discount_type_id'], (int) $data['hospital_id']);

        $discount = Discount::create($data);

        return response()->json($discount->load('type:id,name'), 201);
    }

    public function show(Request $request, Discount $discount)
    {
        $this->authorizeScope($request->user(), $discount->hospital_id);

        return response()->json($discount->load('type:id,name'));
    }

    public function update(Request $request, Discount $discount)
    {
        $this->authorizeScope($request->user(), $discount->hospital_id);

        $data = $this->validatePayload($request, $discount->hospital_id);
        $data['updated_by'] = $request->user()?->name;

        $this->assertTypeScope((int) $data['discount_type_id'], (int) $data['hospital_id']);

        $discount->update($data);

        return response()->json($discount->fresh()->load('type:id,name'));
    }

    public function destroy(Request $request, Discount $discount)
    {
        $this->authorizeScope($request->user(), $discount->hospital_id);

        $discount->update([
            'is_delete' => true,
            'is_active' => false,
            'deleted_by' => $request->user()?->name,
        ]);

        return response()->json(['message' => 'Discount deleted']);
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
            'discount_type_id' => ['required', 'exists:discount_types,id'],
            'amount' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:10'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        } elseif (!isset($data['hospital_id'])) {
            $data['hospital_id'] = $hospitalId;
        }

        return $data;
    }

    private function assertTypeScope(int $discountTypeId, int $hospitalId): void
    {
        $type = DiscountType::query()
            ->where('id', $discountTypeId)
            ->where('hospital_id', $hospitalId)
            ->where('is_delete', false)
            ->first();

        if (!$type) {
            abort(422, 'Discount type does not belong to selected hospital');
        }
    }

    private function authorizeScope($user, int $hospitalId): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $hospitalId) {
            abort(403, 'Unauthorized access');
        }
    }
}
