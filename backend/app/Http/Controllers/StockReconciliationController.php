<?php

namespace App\Http\Controllers;

use App\Models\Stock;
use App\Models\StockReconciliation;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

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

        foreach ($items as $item) {
            StockReconciliation::updateOrCreate(
                [
                    'hospital_id' => $hospitalId,
                    'medicine_id' => (int) $item['medicine_id'],
                    'batch_no' => $item['batch_no'] ?? null,
                    'reconciliation_date' => $date,
                ],
                [
                    'physical_qty' => (int) ($item['physical_qty'] ?? 0),
                    'physical_bonus' => (int) ($item['physical_bonus'] ?? 0),
                    'created_by' => $user->name ?? null,
                ]
            );
        }

        return response()->json(['message' => 'Reconciliation saved']);
    }
}
