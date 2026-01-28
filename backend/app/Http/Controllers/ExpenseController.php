<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class ExpenseController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Expense::query()->with('category');

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('expense_category_id')) {
            $query->where('expense_category_id', $request->integer('expense_category_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('start_date')) {
            $query->whereDate('expense_date', '>=', $request->string('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->whereDate('expense_date', '<=', $request->string('end_date'));
        }

        return response()->json($query->orderByDesc('expense_date')->orderByDesc('id')->get());
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        }

        $expense = DB::transaction(function () use ($data, $request) {
            $hospitalId = (int) ($data['hospital_id'] ?? $request->user()->hospital_id);
            $nextSequence = Expense::where('hospital_id', $hospitalId)
                ->lockForUpdate()
                ->max('sequence_id');
            $data['sequence_id'] = (int) ($nextSequence ?? 0) + 1;
            $data['created_by'] = $data['created_by'] ?? ($request->user()->name ?? null);
            $data['updated_by'] = $data['updated_by'] ?? ($request->user()->name ?? null);

            if ($request->hasFile('document')) {
                $data['document_path'] = $request->file('document')->store('expenses', 'public');
            }

            return Expense::create($data);
        });

        return response()->json($expense->load('category'), 201);
    }

    public function show(Request $request, Expense $expense)
    {
        $this->authorizeScope($request->user(), $expense);

        return response()->json($expense->load('category'));
    }

    public function update(Request $request, Expense $expense)
    {
        $this->authorizeScope($request->user(), $expense);

        $data = $this->validatePayload($request, $expense->id, $expense->hospital_id);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $expense->hospital_id;
        }

        unset($data['sequence_id']);
        $data['updated_by'] = $data['updated_by'] ?? ($request->user()->name ?? null);

        if ($request->hasFile('document')) {
            if ($expense->document_path) {
                Storage::disk('public')->delete($expense->document_path);
            }
            $data['document_path'] = $request->file('document')->store('expenses', 'public');
        }

        $expense->update($data);

        return response()->json($expense->fresh()->load('category'));
    }

    public function destroy(Request $request, Expense $expense)
    {
        $this->authorizeScope($request->user(), $expense);

        $expense->delete();

        return response()->json(['message' => 'Expense deleted']);
    }

    private function validatePayload(Request $request, ?int $expenseId = null, ?int $defaultHospitalId = null): array
    {
        $hospitalId = $request->integer('hospital_id') ?: $defaultHospitalId ?: $request->user()->hospital_id;

        return $request->validate([
            'hospital_id' => [$request->user()->role === 'super_admin' ? 'required' : 'sometimes', 'exists:hospitals,id'],
            'expense_category_id' => [
                'required',
                Rule::exists('expense_categories', 'id')
                    ->where(fn ($q) => $hospitalId ? $q->where('hospital_id', $hospitalId) : $q),
            ],
            'title' => ['required', 'string', 'max:191'],
            'amount' => ['required', 'numeric', 'min:0'],
            'expense_date' => ['required', 'date'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'reference' => ['nullable', 'string', 'max:191'],
            'notes' => ['nullable', 'string'],
            'document' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:4096'],
            'status' => ['required', 'in:approved,pending,rejected'],
        ]);
    }

    private function authorizeScope($user, Expense $expense): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $expense->hospital_id) {
            abort(403, 'Unauthorized expense access');
        }
    }
}
