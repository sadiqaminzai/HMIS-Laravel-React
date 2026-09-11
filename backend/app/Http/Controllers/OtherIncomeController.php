<?php

namespace App\Http\Controllers;

use App\Models\OtherIncome;
use App\Services\LedgerPostingService;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class OtherIncomeController extends Controller
{
    public function __construct(private readonly LedgerPostingService $ledgerPostingService)
    {
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $query = OtherIncome::query()->with('category');

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('other_income_category_id')) {
            $query->where('other_income_category_id', $request->integer('other_income_category_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('start_date')) {
            $query->whereDate('income_date', '>=', $request->string('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->whereDate('income_date', '<=', $request->string('end_date'));
        }

        return response()->json($query->orderByDesc('income_date')->orderByDesc('id')->get());
    }

    public function store(Request $request)
    {
        $hospitalId = $this->resolveHospitalId($request);
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $this->validatePayload($request, null, $hospitalId);
        $data['hospital_id'] = $hospitalId;

        $otherIncome = DB::transaction(function () use ($data, $request) {
            $hospitalId = (int) ($data['hospital_id'] ?? $request->user()->hospital_id);
            $nextSequence = OtherIncome::withTrashed()
                ->where('hospital_id', $hospitalId)
                ->lockForUpdate()
                ->max('sequence_id');
            $data['created_by'] = $data['created_by'] ?? ($request->user()->name ?? null);
            $data['updated_by'] = $data['updated_by'] ?? ($request->user()->name ?? null);

            if ($request->hasFile('document')) {
                $data['document_path'] = $request->file('document')->store('other-incomes', 'public');
            }

            for ($attempt = 0; $attempt < 3; $attempt++) {
                try {
                    $data['sequence_id'] = (int) ($nextSequence ?? 0) + 1;

                    $otherIncome = OtherIncome::create($data);
                    $otherIncome->load('category');
                    $this->ledgerPostingService->upsertOtherIncomeSnapshot($otherIncome);

                    return $otherIncome;
                } catch (QueryException $e) {
                    if (!$this->isDuplicateSequenceError($e)) {
                        throw $e;
                    }

                    // Fallback for environments that may still have a global unique index on sequence_id.
                    $nextSequence = OtherIncome::withTrashed()->lockForUpdate()->max('sequence_id');
                }
            }

            throw ValidationException::withMessages([
                'title' => ['Unable to generate a unique other income number. Please try again.'],
            ]);
        });

        return response()->json($otherIncome->load('category'), 201);
    }

    public function show(Request $request, OtherIncome $otherIncome)
    {
        $this->authorizeScope($request->user(), $otherIncome);

        return response()->json($otherIncome->load('category'));
    }

    public function update(Request $request, OtherIncome $otherIncome)
    {
        $this->authorizeScope($request->user(), $otherIncome);

        $hospitalId = (int) $otherIncome->hospital_id;
        $request->merge(['hospital_id' => $hospitalId]);

        $data = $this->validatePayload($request, $otherIncome->id, $hospitalId);
        $data['hospital_id'] = $hospitalId;

        unset($data['sequence_id']);
        $data['updated_by'] = $data['updated_by'] ?? ($request->user()->name ?? null);

        $this->stampApproval($data, $otherIncome->status, $request->user());

        if ($request->hasFile('document')) {
            if ($otherIncome->document_path) {
                Storage::disk('public')->delete($otherIncome->document_path);
            }
            $data['document_path'] = $request->file('document')->store('other-incomes', 'public');
        }

        $otherIncome->update($data);
        $otherIncome->load('category');
        $this->ledgerPostingService->upsertOtherIncomeSnapshot($otherIncome);

        return response()->json($otherIncome->fresh()->load('category'));
    }

    public function destroy(Request $request, OtherIncome $otherIncome)
    {
        $this->authorizeScope($request->user(), $otherIncome);

        $actor = $request->user()->name ?? null;
        $otherIncome->delete();
        $this->ledgerPostingService->voidOtherIncomeSnapshot($otherIncome, $actor);

        return response()->json(['message' => 'Other income deleted']);
    }

    private function validatePayload(Request $request, ?int $otherIncomeId = null, ?int $defaultHospitalId = null): array
    {
        $hospitalId = $defaultHospitalId ?: $this->resolveHospitalId($request);

        return $request->validate([
            'hospital_id' => ['required', 'exists:hospitals,id'],
            'other_income_category_id' => [
                'required',
                Rule::exists('other_income_categories', 'id')
                    ->where(fn ($q) => $q->where('hospital_id', $hospitalId)),
            ],
            'title' => ['required', 'string', 'max:191'],
            'amount' => ['required', 'numeric', 'min:0'],
            'income_date' => ['required', 'date'],
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
     * Record who signed an entry off, and when. See ExpenseController for why
     * this is stamped only on a real status CHANGE and why the opposite
     * decision's stamp is cleared.
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
            $data['approved_by'] = null;
            $data['approved_at'] = null;
            $data['rejected_by'] = null;
            $data['rejected_at'] = null;
        }
    }

    private function authorizeScope($user, OtherIncome $otherIncome): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $otherIncome->hospital_id) {
            abort(403, 'Unauthorized other income access');
        }
    }

    private function isDuplicateSequenceError(QueryException $exception): bool
    {
        $message = strtolower($exception->getMessage());

        return str_contains($message, 'duplicate')
            && str_contains($message, 'sequence');
    }
}
