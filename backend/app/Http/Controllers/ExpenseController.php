<?php

namespace App\Http\Controllers;

use App\Models\Expense;
use App\Services\LedgerPostingService;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ExpenseController extends Controller
{
    public function __construct(private readonly LedgerPostingService $ledgerPostingService)
    {
    }

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
        $hospitalId = $this->resolveHospitalId($request);
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $this->validatePayload($request, null, $hospitalId);
        $data['hospital_id'] = $hospitalId;

        $expense = DB::transaction(function () use ($data, $request) {
            $hospitalId = (int) ($data['hospital_id'] ?? $request->user()->hospital_id);
            $nextSequence = Expense::withTrashed()
                ->where('hospital_id', $hospitalId)
                ->lockForUpdate()
                ->max('sequence_id');
            $data['created_by'] = $data['created_by'] ?? ($request->user()->name ?? null);
            $data['updated_by'] = $data['updated_by'] ?? ($request->user()->name ?? null);

            if ($request->hasFile('document')) {
                $data['document_path'] = $request->file('document')->store('expenses', 'public');
            }

            for ($attempt = 0; $attempt < 3; $attempt++) {
                try {
                    $data['sequence_id'] = (int) ($nextSequence ?? 0) + 1;

                    $expense = Expense::create($data);
                    $expense->load('category');
                    $this->ledgerPostingService->upsertExpenseSnapshot($expense);

                    return $expense;
                } catch (QueryException $e) {
                    if (!$this->isDuplicateSequenceError($e)) {
                        throw $e;
                    }

                    // Fallback for environments that may still have a global unique index on sequence_id.
                    $nextSequence = Expense::withTrashed()->lockForUpdate()->max('sequence_id');
                }
            }

            throw ValidationException::withMessages([
                'title' => ['Unable to generate a unique expense number. Please try again.'],
            ]);
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

        $hospitalId = (int) $expense->hospital_id;
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $this->validatePayload($request, $expense->id, $hospitalId);
        $data['hospital_id'] = $hospitalId;

        unset($data['sequence_id']);
        $data['updated_by'] = $data['updated_by'] ?? ($request->user()->name ?? null);

        $this->stampApproval($data, $expense->status, $request->user());

        if ($request->hasFile('document')) {
            if ($expense->document_path) {
                Storage::disk('public')->delete($expense->document_path);
            }
            $data['document_path'] = $request->file('document')->store('expenses', 'public');
        }

        $expense->update($data);
        $expense->load('category');
        $this->ledgerPostingService->upsertExpenseSnapshot($expense);

        return response()->json($expense->fresh()->load('category'));
    }

    public function destroy(Request $request, Expense $expense)
    {
        $this->authorizeScope($request->user(), $expense);

        $actor = $request->user()->name ?? null;
        $expense->delete();
        $this->ledgerPostingService->voidExpenseSnapshot($expense, $actor);

        return response()->json(['message' => 'Expense deleted']);
    }

    private function validatePayload(Request $request, ?int $expenseId = null, ?int $defaultHospitalId = null): array
    {
        $hospitalId = $defaultHospitalId ?: $this->resolveHospitalId($request);

        return $request->validate([
            'hospital_id' => ['required', 'exists:hospitals,id'],
            'expense_category_id' => [
                'required',
                Rule::exists('expense_categories', 'id')
                    ->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
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

    /**
     * Record who signed an entry off, and when.
     *
     * Stamped only when the status actually CHANGES into approved or rejected.
     * Writing it on every save would let a later edit to the title overwrite
     * the approver with whoever touched the row last, which is exactly the
     * problem having separate columns is meant to solve.
     *
     * The opposite decision's stamp is cleared on the way through, so a
     * rejected entry that is later approved does not show both.
     */
    private function stampApproval(array &$data, ?string $currentStatus, $user): void
    {
        $next = $data['status'] ?? null;

        if (!$next || $next === $currentStatus) {
            return;
        }

        $name = $user->name ?? null;

        if ($next === 'approved') {
            $data['approved_by'] = $name;
            $data['approved_at'] = now();
            $data['rejected_by'] = null;
            $data['rejected_at'] = null;
        } elseif ($next === 'rejected') {
            $data['rejected_by'] = $name;
            $data['rejected_at'] = now();
            $data['approved_by'] = null;
            $data['approved_at'] = null;
        } else {
            // Back to pending: the previous decision no longer stands.
            $data['approved_by'] = null;
            $data['approved_at'] = null;
            $data['rejected_by'] = null;
            $data['rejected_at'] = null;
        }
    }

    private function authorizeScope($user, Expense $expense): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $expense->hospital_id) {
            abort(403, 'Unauthorized expense access');
        }
    }

    private function isDuplicateSequenceError(QueryException $exception): bool
    {
        $message = strtolower($exception->getMessage());

        return str_contains($message, 'duplicate')
            && str_contains($message, 'sequence');
    }
}
