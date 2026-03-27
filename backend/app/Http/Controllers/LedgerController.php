<?php

namespace App\Http\Controllers;

use App\Models\LedgerEntry;
use Illuminate\Http\Request;

class LedgerController extends Controller
{
    public function index(Request $request)
    {
        $query = $this->buildFilteredQuery($request)->with(['patient:id,name,patient_id', 'supplier:id,name']);

        $perPage = max(1, min($request->integer('per_page', 50), 200));

        return response()->json(
            $query->orderByDesc('posted_at')->orderByDesc('id')->paginate($perPage)
        );
    }

    public function export(Request $request)
    {
        $query = $this->buildFilteredQuery($request)
            ->with(['patient:id,name,patient_id', 'supplier:id,name'])
            ->orderByDesc('posted_at')
            ->orderByDesc('id');

        $fileName = 'ledger_export_' . now()->format('Ymd_His') . '.csv';

        return response()->streamDownload(function () use ($query) {
            $output = fopen('php://output', 'w');

            fputcsv($output, [
                'id',
                'posted_at',
                'module',
                'category',
                'title',
                'source_type',
                'source_id',
                'entry_direction',
                'status',
                'patient',
                'supplier',
                'amount',
                'discount_amount',
                'tax_amount',
                'net_amount',
                'paid_amount',
                'due_amount',
                'currency',
                'posted_by',
            ]);

            $query->chunkById(500, function ($rows) use ($output) {
                foreach ($rows as $row) {
                    fputcsv($output, [
                        $row->id,
                        optional($row->posted_at)->toDateTimeString(),
                        $row->module,
                        $row->category,
                        $row->title,
                        $row->source_type,
                        $row->source_id,
                        $row->entry_direction,
                        $row->status,
                        $row->patient?->name,
                        $row->supplier?->name,
                        $row->amount,
                        $row->discount_amount,
                        $row->tax_amount,
                        $row->net_amount,
                        $row->paid_amount,
                        $row->due_amount,
                        $row->currency,
                        $row->posted_by,
                    ]);
                }
            }, 'id');

            fclose($output);
        }, $fileName, [
            'Content-Type' => 'text/csv',
        ]);
    }

    public function summary(Request $request)
    {
        $query = $this->buildFilteredQuery($request)->whereNull('voided_at');

        $income = (clone $query)->where('entry_direction', 'income')->sum('net_amount');
        $expense = (clone $query)->where('entry_direction', 'expense')->sum('net_amount');
        $due = (clone $query)->sum('due_amount');

        return response()->json([
            'income_total' => round((float) $income, 2),
            'expense_total' => round((float) $expense, 2),
            'net_total' => round((float) $income - (float) $expense, 2),
            'due_total' => round((float) $due, 2),
        ]);
    }

    private function buildFilteredQuery(Request $request)
    {
        $user = $request->user();

        $query = LedgerEntry::query();

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('module')) {
            $query->where('module', $request->string('module'));
        }

        if ($request->filled('entry_direction')) {
            $query->where('entry_direction', $request->string('entry_direction'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('patient_id')) {
            $query->where('patient_id', $request->integer('patient_id'));
        }

        if ($request->filled('supplier_id')) {
            $query->where('supplier_id', $request->integer('supplier_id'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('posted_at', '>=', $request->date('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('posted_at', '<=', $request->date('date_to'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                    ->orWhere('category', 'like', "%{$search}%")
                    ->orWhere('source_type', 'like', "%{$search}%");
            });
        }

        return $query;
    }
}
