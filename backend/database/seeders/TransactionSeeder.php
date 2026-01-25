<?php

namespace Database\Seeders;

use App\Models\Hospital;
use App\Models\Medicine;
use App\Models\Patient;
use App\Models\Stock;
use App\Models\StockMovement;
use App\Models\Supplier;
use App\Models\Transaction;
use App\Models\TransactionDetail;
use Illuminate\Database\Seeder;

class TransactionSeeder extends Seeder
{
    public function run(): void
    {
        $hospital = Hospital::query()->first();
        if (!$hospital) {
            return;
        }

        $supplier = Supplier::query()->where('hospital_id', $hospital->id)->first();
        $patient = Patient::query()->where('hospital_id', $hospital->id)->first();
        $medicine = Medicine::query()->where('hospital_id', $hospital->id)->first();

        if (!$supplier || !$patient || !$medicine) {
            return;
        }

        $batchNo = 'B-001';
        $expiry = now()->addMonths(12)->toDateString();

        $purchaseItems = [
            [
                'medicine_id' => $medicine->id,
                'batch_no' => $batchNo,
                'expiry_date' => $expiry,
                'qtty' => 100,
                'bonus' => 10,
                'price' => (float) ($medicine->cost_price ?? 0.10),
                'discount' => 0,
                'tax' => 0,
            ],
        ];

        $purchase = $this->createTransaction(
            $hospital->id,
            $supplier->id,
            $supplier->name,
            null,
            null,
            'purchase',
            $purchaseItems,
            'Seeder'
        );

        $salesItems = [
            [
                'medicine_id' => $medicine->id,
                'batch_no' => $batchNo,
                'expiry_date' => $expiry,
                'qtty' => 20,
                'bonus' => 2,
                'price' => (float) ($medicine->sale_price ?? 0.20),
                'discount' => 0,
                'tax' => 0,
            ],
        ];

        $this->createTransaction(
            $hospital->id,
            null,
            null,
            $patient->id,
            $patient->name,
            'sales',
            $salesItems,
            'Seeder'
        );

        $purchaseReturnItems = [
            [
                'medicine_id' => $medicine->id,
                'batch_no' => $batchNo,
                'expiry_date' => $expiry,
                'qtty' => 5,
                'bonus' => 1,
                'price' => (float) ($medicine->cost_price ?? 0.10),
                'discount' => 0,
                'tax' => 0,
            ],
        ];

        $this->createTransaction(
            $hospital->id,
            $supplier->id,
            $supplier->name,
            null,
            null,
            'purchase_return',
            $purchaseReturnItems,
            'Seeder'
        );

        $salesReturnItems = [
            [
                'medicine_id' => $medicine->id,
                'batch_no' => $batchNo,
                'expiry_date' => $expiry,
                'qtty' => 2,
                'bonus' => 0,
                'price' => (float) ($medicine->sale_price ?? 0.20),
                'discount' => 0,
                'tax' => 0,
            ],
        ];

        $this->createTransaction(
            $hospital->id,
            null,
            null,
            $patient->id,
            $patient->name,
            'sales_return',
            $salesReturnItems,
            'Seeder'
        );
    }

    private function createTransaction(
        int $hospitalId,
        ?int $supplierId,
        ?string $supplierName,
        ?int $patientId,
        ?string $patientName,
        string $trxType,
        array $items,
        string $actor
    ): Transaction {
        $grandTotal = 0;
        foreach ($items as $item) {
            $grandTotal += $this->calculateLineAmount($item);
        }

        $transaction = Transaction::create([
            'hospital_id' => $hospitalId,
            'supplier_id' => $supplierId,
            'supplier_name' => $supplierName,
            'patient_id' => $patientId,
            'patient_name' => $patientName,
            'trx_type' => $trxType,
            'grand_total' => round($grandTotal, 2),
            'total_discount' => 0,
            'total_tax' => 0,
            'paid_amount' => round($grandTotal, 2),
            'due_amount' => 0,
            'created_by' => $actor,
            'updated_by' => $actor,
        ]);

        foreach ($items as $item) {
            $amount = $this->calculateLineAmount($item);
            TransactionDetail::create([
                'trx_id' => $transaction->id,
                'medicine_id' => $item['medicine_id'],
                'batch_no' => $item['batch_no'] ?? null,
                'expiry_date' => $item['expiry_date'] ?? null,
                'qtty' => $item['qtty'],
                'bonus' => $item['bonus'] ?? 0,
                'price' => $item['price'],
                'discount' => $item['discount'] ?? 0,
                'tax' => $item['tax'] ?? 0,
                'amount' => $amount,
            ]);

            $this->applyStockChange($hospitalId, $item, $trxType, $transaction->id, $actor);
        }

        return $transaction;
    }

    private function calculateLineAmount(array $item): float
    {
        $qtty = (int) ($item['qtty'] ?? 0);
        $price = (float) ($item['price'] ?? 0);
        $discount = (float) ($item['discount'] ?? 0);
        $tax = (float) ($item['tax'] ?? 0);
        $unitDiscount = ($price * $discount) / 100;
        $unitTax = ($price * $tax) / 100;
        return round($qtty * ($price - $unitDiscount + $unitTax), 2);
    }

    private function applyStockChange(int $hospitalId, array $item, string $trxType, int $trxId, string $actor): void
    {
        $medicineId = (int) ($item['medicine_id'] ?? 0);
        $qtty = (int) ($item['qtty'] ?? 0);
        $bonus = (int) ($item['bonus'] ?? 0);
        $price = (float) ($item['price'] ?? 0);
        $expiryDate = $item['expiry_date'] ?? null;

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

        $batchNo = $item['batch_no'] ?? null;
        $stock = Stock::firstOrNew([
            'hospital_id' => $hospitalId,
            'medicine_id' => $medicineId,
            'batch_no' => $batchNo,
        ]);

        if ($expiryDate && (!$stock->expiry_date || (string) $stock->expiry_date !== (string) $expiryDate)) {
            $stock->expiry_date = $expiryDate;
        }
        if (in_array($trxType, ['purchase', 'purchase_return'], true) && $price > 0) {
            $stock->purchase_price = $price;
        }
        if (in_array($trxType, ['sales', 'sales_return'], true) && $price > 0) {
            $stock->sale_price = $price;
        }

        $stock->stock_qty = max(0, ((int) $stock->stock_qty) + $qtyDelta);
        $stock->bonus_qty = max(0, ((int) ($stock->bonus_qty ?? 0)) + $bonusDelta);
        $stock->save();

        $medicine = Medicine::find($medicineId);
        if ($medicine) {
            $medicine->stock = max(0, ((int) $medicine->stock) + ($qtyDelta + $bonusDelta));
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
            'is_reversal' => false,
        ]);
    }
}
