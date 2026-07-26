<?php

namespace App\Http\Controllers;

use App\Models\OtherIncomeCategory;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OtherIncomeCategoryController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = OtherIncomeCategory::query();

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
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        return response()->json($query->orderBy('name')->get());
    }

    public function store(Request $request)
    {
        $hospitalId = $this->resolveHospitalId($request);
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $this->validatePayload($request, null, $hospitalId);
        $data['hospital_id'] = $hospitalId;

        $data['created_by'] = $data['created_by'] ?? ($request->user()->name ?? null);
        $data['updated_by'] = $data['updated_by'] ?? ($request->user()->name ?? null);

        $category = OtherIncomeCategory::create($data);

        return response()->json($category, 201);
    }

    public function show(Request $request, OtherIncomeCategory $otherIncomeCategory)
    {
        $this->authorizeScope($request->user(), $otherIncomeCategory);

        return response()->json($otherIncomeCategory);
    }

    public function update(Request $request, OtherIncomeCategory $otherIncomeCategory)
    {
        $this->authorizeScope($request->user(), $otherIncomeCategory);

        $hospitalId = (int) $otherIncomeCategory->hospital_id;
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $this->validatePayload($request, $otherIncomeCategory->id, $hospitalId);
        $data['hospital_id'] = $hospitalId;

        $data['updated_by'] = $data['updated_by'] ?? ($request->user()->name ?? null);

        $otherIncomeCategory->update($data);

        return response()->json($otherIncomeCategory->fresh());
    }

    public function destroy(Request $request, OtherIncomeCategory $otherIncomeCategory)
    {
        $this->authorizeScope($request->user(), $otherIncomeCategory);

        if ($otherIncomeCategory->otherIncomes()->exists()) {
            throw ValidationException::withMessages([
                'other_income_category_id' => ['Cannot delete other income category because it is used in income records.'],
            ]);
        }

        $otherIncomeCategory->delete();

        return response()->json(['message' => 'Other income category deleted']);
    }

    private function validatePayload(Request $request, ?int $categoryId = null, ?int $defaultHospitalId = null): array
    {
        $hospitalId = $defaultHospitalId ?: $this->resolveHospitalId($request);

        return $request->validate([
            'hospital_id' => ['required', 'exists:hospitals,id'],
            'name' => [
                'required',
                'string',
                'max:150',
                Rule::unique('other_income_categories', 'name')
                    ->ignore($categoryId)
                    ->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
            ],
            'description' => ['nullable', 'string'],
            'status' => ['required', 'in:active,inactive'],
        ]);
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

    private function authorizeScope($user, OtherIncomeCategory $otherIncomeCategory): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $otherIncomeCategory->hospital_id) {
            abort(403, 'Unauthorized other income category access');
        }
    }
}
