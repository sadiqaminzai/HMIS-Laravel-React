<?php

namespace App\Http\Controllers;

use App\Models\ExpenseCategory;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ExpenseCategoryController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = ExpenseCategory::query();

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
        $data = $this->validatePayload($request);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        }

        $data['created_by'] = $data['created_by'] ?? ($request->user()->name ?? null);
        $data['updated_by'] = $data['updated_by'] ?? ($request->user()->name ?? null);

        $category = ExpenseCategory::create($data);

        return response()->json($category, 201);
    }

    public function show(Request $request, ExpenseCategory $expenseCategory)
    {
        $this->authorizeScope($request->user(), $expenseCategory);

        return response()->json($expenseCategory);
    }

    public function update(Request $request, ExpenseCategory $expenseCategory)
    {
        $this->authorizeScope($request->user(), $expenseCategory);

        $data = $this->validatePayload($request, $expenseCategory->id, $expenseCategory->hospital_id);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $expenseCategory->hospital_id;
        }

        $data['updated_by'] = $data['updated_by'] ?? ($request->user()->name ?? null);

        $expenseCategory->update($data);

        return response()->json($expenseCategory->fresh());
    }

    public function destroy(Request $request, ExpenseCategory $expenseCategory)
    {
        $this->authorizeScope($request->user(), $expenseCategory);

        $expenseCategory->delete();

        return response()->json(['message' => 'Expense category deleted']);
    }

    private function validatePayload(Request $request, ?int $categoryId = null, ?int $defaultHospitalId = null): array
    {
        $hospitalId = $request->integer('hospital_id') ?: $defaultHospitalId ?: $request->user()->hospital_id;

        return $request->validate([
            'hospital_id' => [$request->user()->role === 'super_admin' ? 'required' : 'sometimes', 'exists:hospitals,id'],
            'name' => [
                'required',
                'string',
                'max:150',
                Rule::unique('expense_categories', 'name')
                    ->ignore($categoryId)
                    ->where(fn ($q) => $hospitalId ? $q->where('hospital_id', $hospitalId) : $q),
            ],
            'description' => ['nullable', 'string'],
            'status' => ['required', 'in:active,inactive'],
        ]);
    }

    private function authorizeScope($user, ExpenseCategory $expenseCategory): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $expenseCategory->hospital_id) {
            abort(403, 'Unauthorized expense category access');
        }
    }
}
