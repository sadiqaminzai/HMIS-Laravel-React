<?php

namespace App\Http\Controllers;

use App\Models\Medicine;
use App\Models\Patient;
use App\Models\Stock;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\Transaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

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
        $this->authorizeTransactionAction($request->user(), 'add_transactions');

        $data = $this->validatePayload($request);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        }

        $this->ensurePartyConsistency($data);
        $this->fillPartyNames($data);
        $this->ensureStockAvailable(
            (int) ($data['hospital_id'] ?? $request->user()->hospital_id),
            (string) ($data['trx_type'] ?? ''),
            $data['items'] ?? []
        );

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

                $this->applyStockChange(
                    (int) $transaction->hospital_id,
                    $normalized,
                    $transaction->trx_type,
                    false,
                    (int) $transaction->id,
                    $request->user()->name ?? null
                );
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
        $this->authorizeTransactionAction($request->user(), 'edit_transactions');
        $this->authorizeScope($request->user(), $transaction);

        $data = $this->validatePayload($request, $transaction->hospital_id, true, $transaction->trx_type);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $transaction->hospital_id;
        }

        $this->ensurePartyConsistency($data);
        $this->fillPartyNames($data);

        $actor = $request->user()->name ?? null;

        $transaction = DB::transaction(function () use ($data, $transaction, $request, $actor) {
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
                        'price' => $detail->price,
                        'expiry_date' => $detail->expiry_date,
                    ],
                    $transaction->trx_type,
                    true,
                    (int) $transaction->id,
                    $actor
                );
            }

            $this->ensureStockAvailable(
                (int) $transaction->hospital_id,
                (string) ($data['trx_type'] ?? $transaction->trx_type),
                $items
            );

            $transaction->details()->delete();

            $transaction->update($data);

            foreach ($items as $item) {
                $this->ensureHospitalConsistency($transaction->hospital_id, (int) $item['medicine_id']);

                $normalized = $this->normalizeItem($item);
                $transaction->details()->create($normalized);

                $this->applyStockChange(
                    (int) $transaction->hospital_id,
                    $normalized,
                    $transaction->trx_type,
                    false,
                    (int) $transaction->id,
                    $actor
                );
            }

            return $transaction->load(['details.medicine', 'supplier', 'patient']);
        });

        return response()->json($transaction);
    }

    public function destroy(Request $request, Transaction $transaction)
    {
        $this->authorizeTransactionAction($request->user(), 'delete_transactions');
        $this->authorizeScope($request->user(), $transaction);

        $actor = $request->user()->name ?? null;

        DB::transaction(function () use ($transaction, $actor) {
            $transaction->load('details');

            foreach ($transaction->details as $detail) {
                $this->applyStockChange(
                    (int) $transaction->hospital_id,
                    [
                        'medicine_id' => $detail->medicine_id,
                        'batch_no' => $detail->batch_no,
                        'qtty' => $detail->qtty,
                        'bonus' => $detail->bonus,
                        'price' => $detail->price,
                        'expiry_date' => $detail->expiry_date,
                    ],
                    $transaction->trx_type,
                    true,
                    (int) $transaction->id,
                    $actor
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

    private function ensureStockAvailable(int $hospitalId, string $trxType, array $items): void
    {
        if (!in_array($trxType, ['sales', 'purchase_return'], true)) {
            return;
        }

        $requiredByKey = [];
        foreach ($items as $item) {
            $medicineId = (int) ($item['medicine_id'] ?? 0);
            if (!$medicineId) {
                continue;
            }
            $batchNo = $item['batch_no'] ?? null;
            $requiredQty = (int) ($item['qtty'] ?? 0);
            $requiredBonus = (int) ($item['bonus'] ?? 0);
            if ($requiredQty <= 0 && $requiredBonus <= 0) {
                continue;
            }

            $key = $medicineId . '::' . ($batchNo ?? '__all__');
            if (!isset($requiredByKey[$key])) {
                $requiredByKey[$key] = ['qty' => 0, 'bonus' => 0];
            }
            $requiredByKey[$key]['qty'] += $requiredQty;
            $requiredByKey[$key]['bonus'] += $requiredBonus;
        }

        foreach ($requiredByKey as $key => $required) {
            [$medicineIdRaw, $batchNo] = explode('::', $key, 2);
            $medicineId = (int) $medicineIdRaw;

            $query = Stock::query()
                ->where('hospital_id', $hospitalId)
                ->where('medicine_id', $medicineId);

            if ($batchNo !== '__all__') {
                $query->where('batch_no', $batchNo);
            }

            $availableQty = (int) $query->sum('stock_qty');
            $availableBonus = (int) $query->sum('bonus_qty');

            if ($availableQty < $required['qty'] || $availableBonus < $required['bonus']) {
                $medicine = Medicine::find($medicineId);
                $name = $medicine?->brand_name ?? 'Medicine';
                $batchLabel = $batchNo !== '__all__' ? " (Batch: {$batchNo})" : '';

                $segments = [];
                if ($availableQty < $required['qty']) {
                    $segments[] = "Qty available: {$availableQty}, required: {$required['qty']}";
                }
                if ($availableBonus < $required['bonus']) {
                    $segments[] = "Bonus available: {$availableBonus}, required: {$required['bonus']}";
                }
                $detail = implode('. ', $segments);

                throw ValidationException::withMessages([
                    'items' => "Insufficient stock for {$name}{$batchLabel}. {$detail}.",
                ]);
            }
        }
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

    private function fillPartyNames(array &$data): void
    {
        $data['supplier_name'] = null;
        $data['patient_name'] = null;

        if (!empty($data['supplier_id'])) {
            $supplier = Supplier::find((int) $data['supplier_id']);
            $data['supplier_name'] = $supplier?->name;
        }

        if (!empty($data['patient_id'])) {
            $patient = Patient::find((int) $data['patient_id']);
            $data['patient_name'] = $patient?->name;
        }
    }

    private function applyStockChange(int $hospitalId, array $item, string $trxType, bool $reverse = false, ?int $trxId = null, ?string $actor = null): void
    {
        $medicineId = (int) ($item['medicine_id'] ?? 0);
        $qtty = (int) ($item['qtty'] ?? 0);
        $bonus = (int) ($item['bonus'] ?? 0);
        $price = (float) ($item['price'] ?? 0);
        $expiryDate = $item['expiry_date'] ?? null;
        $batchNo = $item['batch_no'] ?? null;
        $medicine = Medicine::query()->whereKey($medicineId)->lockForUpdate()->first();
        $batchLabel = $batchNo ? " (Batch: {$batchNo})" : '';
        $medicineLabel = 'Medicine #' . $medicineId;
        if ($medicine?->brand_name) {
            $medicineLabel = $medicine->brand_name;
        }

        $qtyDelta = match ($trxType) {
            'purchase' => $qtty,
            'purchase_return' => -1 * $qtty,
            'sales' => -1 * $qtty,
            'sales_return' => $qtty,
            default => 0,
        };
        $bonusDelta = match ($trxType) {
            'purchase' => $bonus,
            'purchase_return' => -1 * $bonus,
            'sales' => -1 * $bonus,
            'sales_return' => $bonus,
            default => 0,
        };
        if ($reverse) {
            $qtyDelta *= -1;
            $bonusDelta *= -1;
        }

        $stock = Stock::query()
            ->where('hospital_id', $hospitalId)
            ->where('medicine_id', $medicineId);

        if ($batchNo === null) {
            $stock->whereNull('batch_no');
        } else {
            $stock->where('batch_no', $batchNo);
        }

        $stock = $stock
            ->lockForUpdate()
            ->first();

        if (!$stock) {
            if ($qtyDelta < 0 || $bonusDelta < 0) {
                $requiredSegments = [];
                if ($qtyDelta < 0) {
                    $requiredSegments[] = 'quantity reduction: ' . abs($qtyDelta);
                }
                if ($bonusDelta < 0) {
                    $requiredSegments[] = 'bonus reduction: ' . abs($bonusDelta);
                }
                throw ValidationException::withMessages([
                    'items' => "Cannot reduce stock for {$medicineLabel}{$batchLabel}: no stock record exists (" . implode(', ', $requiredSegments) . ").",
                ]);
            }

            $stock = new Stock([
                'hospital_id' => $hospitalId,
                'medicine_id' => $medicineId,
                'batch_no' => $batchNo,
                'stock_qty' => 0,
                'bonus_qty' => 0,
            ]);
        }

        if ($expiryDate && (!$stock->expiry_date || (string) $stock->expiry_date !== (string) $expiryDate)) {
            $stock->expiry_date = $expiryDate;
        }
        if (in_array($trxType, ['purchase', 'purchase_return'], true) && $price > 0) {
            $stock->purchase_price = $price;
        }
        if (in_array($trxType, ['sales', 'sales_return'], true) && $price > 0) {
            $stock->sale_price = $price;
        }

        $newStockQty = ((int) $stock->stock_qty) + $qtyDelta;
        $newBonusQty = ((int) ($stock->bonus_qty ?? 0)) + $bonusDelta;

        if ($newStockQty < 0 || $newBonusQty < 0) {
            $parts = [];
            if ($newStockQty < 0) {
                $parts[] = 'Qty available: ' . (int) $stock->stock_qty . ', delta: ' . $qtyDelta;
            }
            if ($newBonusQty < 0) {
                $parts[] = 'Bonus available: ' . (int) ($stock->bonus_qty ?? 0) . ', delta: ' . $bonusDelta;
            }
            $detail = implode('. ', $parts);
            throw ValidationException::withMessages([
                'items' => "Insufficient stock to apply this transaction for {$medicineLabel}{$batchLabel}. {$detail}.",
            ]);
        }

        $stock->stock_qty = $newStockQty;
        $stock->bonus_qty = $newBonusQty;
        $stock->save();

        if ($medicine) {
            $newMedicineStock = ((int) $medicine->stock) + $qtyDelta + $bonusDelta;
            if ($newMedicineStock < 0) {
                throw ValidationException::withMessages([
                    'items' => "Insufficient aggregate stock for {$medicineLabel}. Available: " . (int) $medicine->stock . ', Delta: ' . ($qtyDelta + $bonusDelta),
                ]);
            }

            $medicine->stock = $newMedicineStock;
            $medicine->save();
        }

        StockMovement::create([
            'hospital_id' => $hospitalId,
            'medicine_id' => $medicineId,
            'trx_id' => $trxId,
            'trx_type' => $trxType,
            'batch_no' => $batchNo,
            'expiry_date' => $expiryDate ?: $stock->expiry_date,
            'qty_change' => $qtyDelta,
            'bonus_change' => $bonusDelta,
            'unit_price' => $price,
            'balance_qty' => (int) $stock->stock_qty,
            'balance_bonus' => (int) ($stock->bonus_qty ?? 0),
            'actor' => $actor,
            'is_reversal' => $reverse,
        ]);
    }

    private function authorizeTransactionAction($user, string $permission): void
    {
        $this->ensureAnyPermission(
            $user,
            [$permission, 'manage_transactions'],
            'Only users with transaction permissions can manage transactions'
        );
    }

    private function authorizeScope($user, Transaction $transaction): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $transaction->hospital_id) {
            abort(403, 'Unauthorized transaction access');
        }
    }
}
