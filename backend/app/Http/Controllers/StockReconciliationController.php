<?php

namespace App\Http\Controllers;

use App\Models\Medicine;
use App\Models\Stock;
use App\Models\StockMovement;
use App\Models\StockReconciliation;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class StockReconciliationController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $date = $request->date('date')?->toDateString() ?? now()->toDateString();

        $hospitalId = $user->role === 'super_admin'
            ? ($request->integer('hospital_id') ?: null)
            : ($user->hospital_id ?? null);

        if (!$hospitalId) {
            return response()->json(['message' => 'Hospital is required'], 422);
        }

        $stocks = Stock::query()
            ->with('medicine:id,brand_name')
            ->where('hospital_id', $hospitalId)
            ->orderBy('medicine_id')
            ->get();

        $recons = StockReconciliation::query()
            ->where('hospital_id', $hospitalId)
            ->whereDate('reconciliation_date', $date)
            ->get()
            ->keyBy(fn ($r) => ($r->medicine_id . '::' . ($r->batch_no ?? '')));

        $rows = $stocks->map(function ($s) use ($recons) {
            $key = $s->medicine_id . '::' . ($s->batch_no ?? '');
            $rec = $recons->get($key);
            $systemQty = (int) $s->stock_qty;
            $systemBonus = (int) ($s->bonus_qty ?? 0);
            $total = $systemQty + $systemBonus;
            $physicalQty = $rec?->physical_qty;
            $physicalBonus = $rec?->physical_bonus;
            $physicalTotal = $physicalQty !== null || $physicalBonus !== null
                ? ((int) ($physicalQty ?? 0) + (int) ($physicalBonus ?? 0))
                : null;

            return [
                'medicine_id' => $s->medicine_id,
                'medicine_name' => $s->medicine?->brand_name ?? 'Unknown',
                'batch_no' => $s->batch_no,
                'expiry_date' => $s->expiry_date ? $s->expiry_date->toDateString() : null,
                'system_qty' => $systemQty,
                'system_bonus' => $systemBonus,
                'system_total' => $total,
                'physical_qty' => $physicalQty,
                'physical_bonus' => $physicalBonus,
                'physical_total' => $physicalTotal,
                'variance' => $physicalTotal !== null ? ($physicalTotal - $total) : null,
            ];
        });

        return response()->json([
            'date' => $date,
            'hospital_id' => $hospitalId,
            'rows' => $rows,
        ]);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $date = $request->date('date')?->toDateString() ?? now()->toDateString();

        $data = $request->validate([
            'hospital_id' => [$user->role === 'super_admin' ? 'required' : 'sometimes', 'exists:hospitals,id'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.medicine_id' => ['required', 'exists:medicines,id'],
            'items.*.batch_no' => ['nullable', 'string', 'max:255'],
            'items.*.physical_qty' => ['nullable', 'integer', 'min:0'],
            'items.*.physical_bonus' => ['nullable', 'integer', 'min:0'],
        ]);

        $hospitalId = $user->role === 'super_admin'
            ? (int) ($data['hospital_id'] ?? 0)
            : (int) ($user->hospital_id ?? 0);

        $items = $data['items'];

        $appliedCount = DB::transaction(function () use ($items, $hospitalId, $date, $user) {
            $applied = 0;
            $touchedMedicineIds = [];

            foreach ($items as $item) {
                $medicineId = (int) $item['medicine_id'];
                $touchedMedicineIds[$medicineId] = true;
                $batchNo = $item['batch_no'] ?? null;
                $physicalQty = (int) ($item['physical_qty'] ?? 0);
                $physicalBonus = (int) ($item['physical_bonus'] ?? 0);

                StockReconciliation::updateOrCreate(
                    [
                        'hospital_id' => $hospitalId,
                        'medicine_id' => $medicineId,
                        'batch_no' => $batchNo,
                        'reconciliation_date' => $date,
                    ],
                    [
                        'physical_qty' => $physicalQty,
                        'physical_bonus' => $physicalBonus,
                        'created_by' => $user->name ?? null,
                    ]
                );

                $stock = Stock::query()
                    ->where('hospital_id', $hospitalId)
                    ->where('medicine_id', $medicineId)
                    ->where('batch_no', $batchNo)
                    ->lockForUpdate()
                    ->first();

                if (!$stock) {
                    $medicine = Medicine::query()
                        ->whereKey($medicineId)
                        ->where('hospital_id', $hospitalId)
                        ->lockForUpdate()
                        ->first();

                    if (!$medicine) {
                        abort(422, 'Medicine does not belong to selected hospital');
                    }

                    $stock = new Stock([
                        'hospital_id' => $hospitalId,
                        'medicine_id' => $medicineId,
                        'batch_no' => $batchNo,
                        'stock_qty' => 0,
                        'bonus_qty' => 0,
                        'purchase_price' => (float) ($medicine->cost_price ?? 0),
                        'sale_price' => (float) ($medicine->sale_price ?? 0),
                    ]);
                }

                $previousQty = (int) $stock->stock_qty;
                $previousBonus = (int) ($stock->bonus_qty ?? 0);

                $deltaQty = $physicalQty - $previousQty;
                $deltaBonus = $physicalBonus - $previousBonus;

                $stock->stock_qty = $physicalQty;
                $stock->bonus_qty = $physicalBonus;
                $stock->save();

                if ($deltaQty !== 0 || $deltaBonus !== 0) {
                    StockMovement::create([
                        'hospital_id' => $hospitalId,
                        'medicine_id' => $medicineId,
                        'trx_id' => null,
                        'trx_type' => 'adjustment',
                        'batch_no' => $batchNo,
                        'expiry_date' => $stock->expiry_date,
                        'qty_change' => $deltaQty,
                        'bonus_change' => $deltaBonus,
                        'unit_price' => (float) ($stock->purchase_price ?? $stock->sale_price ?? 0),
                        'balance_qty' => (int) $stock->stock_qty,
                        'balance_bonus' => (int) ($stock->bonus_qty ?? 0),
                        'actor' => $user->name ?? null,
                        'is_reversal' => false,
                    ]);
                }

                $applied++;
            }

            foreach (array_keys($touchedMedicineIds) as $medicineId) {
                $aggregateStock = (int) Stock::query()
                    ->where('hospital_id', $hospitalId)
                    ->where('medicine_id', $medicineId)
                    ->sum(DB::raw('stock_qty + COALESCE(bonus_qty, 0)'));

                Medicine::query()
                    ->where('hospital_id', $hospitalId)
                    ->whereKey($medicineId)
                    ->update(['stock' => $aggregateStock]);
            }

            return $applied;
        });

        return response()->json([
            'message' => 'Reconciliation saved and stock updated',
            'applied_count' => $appliedCount,
        ]);
    }
}
