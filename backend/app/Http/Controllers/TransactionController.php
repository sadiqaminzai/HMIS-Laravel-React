<?php

namespace App\Http\Controllers;

use App\Models\Medicine;
use App\Models\Patient;
use App\Models\Stock;
use App\Models\Supplier;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class TransactionController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Transaction::query()->with(['details.medicine', 'supplier', 'patient']);

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('trx_type')) {
            $query->where('trx_type', $request->string('trx_type'));
        }

        return response()->json($query->orderByDesc('created_at')->get());
    }

    public function store(Request $request)
    {
        $this->authorizePharmacy($request->user());

        $data = $this->validatePayload($request);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        }

        $this->ensurePartyConsistency($data);

        $transaction = DB::transaction(function () use ($data, $request) {
            $items = $data['items'] ?? [];
            unset($data['items']);

            $data['created_by'] = $data['created_by'] ?? ($request->user()->name ?? null);
            $data['updated_by'] = $data['updated_by'] ?? ($request->user()->name ?? null);

            $data['total_discount'] = $data['total_discount'] ?? 0;
            $data['total_tax'] = $data['total_tax'] ?? 0;
            if (!array_key_exists('paid_amount', $data) || $data['paid_amount'] === null) {
                $data['paid_amount'] = 0;
            }

            $data['grand_total'] = $data['grand_total'] ?? $this->calculateGrandTotal($items);
            $data['due_amount'] = $data['due_amount'] ?? max(0, (float) $data['grand_total'] - (float) $data['paid_amount']);

            $transaction = Transaction::create($data);

            foreach ($items as $item) {
                $this->ensureHospitalConsistency($transaction->hospital_id, (int) $item['medicine_id']);

                $normalized = $this->normalizeItem($item);
                $transaction->details()->create($normalized);

                $this->applyStockChange((int) $transaction->hospital_id, $normalized, $transaction->trx_type, false);
            }

            return $transaction->load(['details.medicine', 'supplier', 'patient']);
        });

        return response()->json($transaction, 201);
    }

    public function show(Request $request, Transaction $transaction)
    {
        $this->authorizeScope($request->user(), $transaction);

        return response()->json($transaction->load(['details.medicine', 'supplier', 'patient']));
    }

    public function update(Request $request, Transaction $transaction)
    {
        $this->authorizePharmacy($request->user());
        $this->authorizeScope($request->user(), $transaction);

        $data = $this->validatePayload($request, $transaction->hospital_id, true, $transaction->trx_type);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $transaction->hospital_id;
        }

        $this->ensurePartyConsistency($data);

        $transaction = DB::transaction(function () use ($data, $transaction, $request) {
            $items = $data['items'] ?? [];
            unset($data['items']);

            $data['updated_by'] = $data['updated_by'] ?? ($request->user()->name ?? null);

            $data['total_discount'] = $data['total_discount'] ?? $transaction->total_discount;
            $data['total_tax'] = $data['total_tax'] ?? $transaction->total_tax;
            if (!array_key_exists('paid_amount', $data) || $data['paid_amount'] === null) {
                $data['paid_amount'] = $transaction->paid_amount;
            }

            $data['grand_total'] = $data['grand_total'] ?? $this->calculateGrandTotal($items);
            $data['due_amount'] = $data['due_amount'] ?? max(0, (float) $data['grand_total'] - (float) $data['paid_amount']);

            $transaction->load('details');

            foreach ($transaction->details as $detail) {
                $this->applyStockChange(
                    (int) $transaction->hospital_id,
                    [
                        'medicine_id' => $detail->medicine_id,
                        'batch_no' => $detail->batch_no,
                        'qtty' => $detail->qtty,
                        'bonus' => $detail->bonus,
                    ],
                    $transaction->trx_type,
                    true
                );
            }

            $transaction->details()->delete();

            $transaction->update($data);

            foreach ($items as $item) {
                $this->ensureHospitalConsistency($transaction->hospital_id, (int) $item['medicine_id']);

                $normalized = $this->normalizeItem($item);
                $transaction->details()->create($normalized);

                $this->applyStockChange((int) $transaction->hospital_id, $normalized, $transaction->trx_type, false);
            }

            return $transaction->load(['details.medicine', 'supplier', 'patient']);
        });

        return response()->json($transaction);
    }

    public function destroy(Request $request, Transaction $transaction)
    {
        $this->authorizePharmacy($request->user());
        $this->authorizeScope($request->user(), $transaction);

        DB::transaction(function () use ($transaction) {
            $transaction->load('details');

            foreach ($transaction->details as $detail) {
                $this->applyStockChange(
                    (int) $transaction->hospital_id,
                    [
                        'medicine_id' => $detail->medicine_id,
                        'batch_no' => $detail->batch_no,
                        'qtty' => $detail->qtty,
                        'bonus' => $detail->bonus,
                    ],
                    $transaction->trx_type,
                    true
                );
            }

            $transaction->delete();
        });

        return response()->json(['message' => 'Transaction deleted']);
    }

    private function validatePayload(Request $request, ?int $defaultHospitalId = null, bool $isUpdate = false, ?string $defaultTrxType = null): array
    {
        $hospitalId = $request->integer('hospital_id') ?: $defaultHospitalId ?: $request->user()->hospital_id;
        $trxType = $request->input('trx_type') ?? $defaultTrxType;

        return $request->validate([
            'hospital_id' => [$request->user()->role === 'super_admin' ? 'required' : 'sometimes', 'exists:hospitals,id'],
            'trx_type' => [$isUpdate ? 'sometimes' : 'required', 'in:purchase,sales,purchase_return,sales_return'],
            'supplier_id' => [
                Rule::requiredIf(fn () => in_array($request->input('trx_type'), ['purchase', 'purchase_return'], true)),
                'nullable',
                'exists:suppliers,id',
            ],
            'patient_id' => [
                Rule::requiredIf(fn () => in_array($request->input('trx_type'), ['sales', 'sales_return'], true)),
                'nullable',
                'exists:patients,id',
            ],
            'grand_total' => ['nullable', 'numeric', 'min:0'],
            'total_discount' => ['nullable', 'numeric', 'min:0'],
            'total_tax' => ['nullable', 'numeric', 'min:0'],
            'paid_amount' => ['nullable', 'numeric', 'min:0'],
            'due_amount' => ['nullable', 'numeric', 'min:0'],
            'created_by' => ['nullable', 'string', 'max:255'],
            'updated_by' => ['nullable', 'string', 'max:255'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.medicine_id' => ['required', 'exists:medicines,id'],
            'items.*.batch_no' => ['nullable', 'string', 'max:255'],
            'items.*.expiry_date' => ['nullable', 'date'],
            'items.*.qtty' => ['required', 'integer', 'min:1'],
            'items.*.bonus' => ['nullable', 'integer', 'min:0'],
            'items.*.price' => ['required', 'numeric', 'min:0'],
            'items.*.discount' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'items.*.tax' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);
    }

    private function normalizeItem(array $item): array
    {
        $qtty = (int) ($item['qtty'] ?? 0);
        $price = (float) ($item['price'] ?? 0);
        $discount = (float) ($item['discount'] ?? 0);
        $tax = (float) ($item['tax'] ?? 0);

        $unitDiscount = ($price * $discount) / 100;
        $unitTax = ($price * $tax) / 100;
        $amount = $qtty * ($price - $unitDiscount + $unitTax);

        return [
            'medicine_id' => $item['medicine_id'],
            'batch_no' => $item['batch_no'] ?? null,
            'expiry_date' => $item['expiry_date'] ?? null,
            'qtty' => $qtty,
            'bonus' => (int) ($item['bonus'] ?? 0),
            'price' => $price,
            'discount' => $discount,
            'tax' => $tax,
            'amount' => round($amount, 2),
        ];
    }

    private function calculateGrandTotal(array $items): float
    {
        $total = 0;
        foreach ($items as $item) {
            $normalized = $this->normalizeItem($item);
            $total += (float) $normalized['amount'];
        }

        return round($total, 2);
    }

    private function ensureHospitalConsistency(int $hospitalId, int $medicineId): void
    {
        $medicine = Medicine::findOrFail($medicineId);

        if ((int) $medicine->hospital_id !== (int) $hospitalId) {
            abort(422, 'Medicine does not belong to the selected hospital');
        }
    }

    private function ensurePartyConsistency(array $data): void
    {
        $hospitalId = (int) ($data['hospital_id'] ?? 0);

        if (!empty($data['supplier_id'])) {
            $supplier = Supplier::findOrFail((int) $data['supplier_id']);
            if ((int) $supplier->hospital_id !== $hospitalId) {
                abort(422, 'Supplier does not belong to the selected hospital');
            }
        }

        if (!empty($data['patient_id'])) {
            $patient = Patient::findOrFail((int) $data['patient_id']);
            if ((int) $patient->hospital_id !== $hospitalId) {
                abort(422, 'Patient does not belong to the selected hospital');
            }
        }
    }

    private function applyStockChange(int $hospitalId, array $item, string $trxType, bool $reverse = false): void
    {
        $medicineId = (int) ($item['medicine_id'] ?? 0);
        $qtty = (int) ($item['qtty'] ?? 0);
        $bonus = (int) ($item['bonus'] ?? 0);

        $delta = match ($trxType) {
            'purchase' => ($qtty + $bonus),
            'purchase_return' => -1 * ($qtty + $bonus),
            'sales' => -1 * ($qtty + $bonus),
            'sales_return' => ($qtty + $bonus),
            default => 0,
        };
        if ($reverse) {
            $delta *= -1;
        }

        $batchNo = $item['batch_no'] ?? null;
        $stock = Stock::firstOrNew([
            'hospital_id' => $hospitalId,
            'medicine_id' => $medicineId,
            'batch_no' => $batchNo,
        ]);

        $stock->stock_qty = max(0, ((int) $stock->stock_qty) + $delta);
        $stock->save();

        $medicine = Medicine::find($medicineId);
        if ($medicine) {
            $medicine->stock = max(0, ((int) $medicine->stock) + $delta);
            $medicine->save();
        }
    }

    private function authorizePharmacy($user): void
    {
        if (!in_array($user->role, ['admin', 'super_admin', 'pharmacist'])) {
            abort(403, 'Only admins, pharmacists, or super admins can manage transactions');
        }
    }

    private function authorizeScope($user, Transaction $transaction): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $transaction->hospital_id) {
            abort(403, 'Unauthorized transaction access');
        }
    }
}
