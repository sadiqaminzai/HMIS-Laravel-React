<?php

namespace App\Http\Controllers;

use App\Models\Stock;
use Illuminate\Http\Request;

class StockController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = Stock::query()->with(['medicine:id,brand_name,hospital_id']);

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('medicine_id')) {
            $query->where('medicine_id', $request->integer('medicine_id'));
        }

        if ($request->filled('batch_no')) {
            $query->where('batch_no', $request->string('batch_no'));
        }

        return response()->json($query->orderBy('medicine_id')->get());
    }

    public function show(Request $request, Stock $stock)
    {
        $this->authorizeScope($request->user(), $stock);

        return response()->json($stock->load(['medicine:id,brand_name,hospital_id']));
    }

    private function authorizeScope($user, Stock $stock): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $stock->hospital_id) {
            abort(403, 'Unauthorized stock access');
        }
    }
}
