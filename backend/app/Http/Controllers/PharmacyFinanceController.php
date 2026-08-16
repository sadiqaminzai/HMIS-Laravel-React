<?php

namespace App\Http\Controllers;

use App\Models\Transaction;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Financial control over pharmacy documents.
 *
 * The operational side (TransactionController) creates invoices, purchases and
 * returns. This controller owns only the money: what is paid, what is
 * outstanding, and who settled it. Each document type is gated by its own
 * permission so, for example, a cashier can settle patient invoices without
 * seeing supplier purchase figures.
 */
class PharmacyFinanceController extends Controller
{
    /**
     * Document type => permissions that grant read access to it.
     *
     * @var array<string, array<int, string>>
     */
    private const TYPE_PERMISSIONS = [
        'sales' => ['view_finance_sales', 'manage_finance'],
        'purchase' => ['view_finance_purchases', 'manage_finance'],
        'sales_return' => ['view_finance_sales_returns', 'manage_finance'],
        'purchase_return' => ['view_finance_purchase_returns', 'manage_finance'],
    ];

    public function index(Request $request)
    {
        $user = $request->user();
        $allowedTypes = $this->allowedTypes($user);

        if (empty($allowedTypes)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $query = $this->scopedQuery($request, $allowedTypes);

        $perPage = min(max((int) $request->integer('per_page', 25), 1), 200);

        return response()->json(
            $query->orderByDesc('created_at')
                ->orderByDesc('id')
                ->paginate($perPage)
                ->appends($request->query())
        );
    }

    /**
     * Totals per document type for the current filters.
     */
    public function summary(Request $request)
    {
        $user = $request->user();
        $allowedTypes = $this->allowedTypes($user);

        if (empty($allowedTypes)) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $rows = $this->scopedQuery($request, $allowedTypes)
            ->selectRaw('trx_type,
                COUNT(*) as document_count,
                COALESCE(SUM(grand_total), 0) as total_amount,
                COALESCE(SUM(paid_amount), 0) as paid_amount,
                COALESCE(SUM(due_amount), 0) as due_amount,
                SUM(CASE WHEN payment_status = \'pending\' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN payment_status = \'partial\' THEN 1 ELSE 0 END) as partial_count,
                SUM(CASE WHEN payment_status = \'paid\' THEN 1 ELSE 0 END) as paid_count')
            ->groupBy('trx_type')
            ->get()
            ->keyBy('trx_type');

        $byType = [];
        foreach ($allowedTypes as $type) {
            $row = $rows->get($type);
            $byType[$type] = [
                'document_count' => (int) ($row->document_count ?? 0),
                'total_amount' => round((float) ($row->total_amount ?? 0), 2),
                'paid_amount' => round((float) ($row->paid_amount ?? 0), 2),
                'due_amount' => round((float) ($row->due_amount ?? 0), 2),
                'pending_count' => (int) ($row->pending_count ?? 0),
                'partial_count' => (int) ($row->partial_count ?? 0),
                'paid_count' => (int) ($row->paid_count ?? 0),
            ];
        }

        return response()->json([
            'allowed_types' => array_values($allowedTypes),
            'by_type' => $byType,
            'totals' => [
                'total_amount' => round(array_sum(array_column($byType, 'total_amount')), 2),
                'paid_amount' => round(array_sum(array_column($byType, 'paid_amount')), 2),
                'due_amount' => round(array_sum(array_column($byType, 'due_amount')), 2),
                'document_count' => array_sum(array_column($byType, 'document_count')),
            ],
        ]);
    }

    /**
     * Record a payment against a document and re-derive its status.
     */
    public function recordPayment(Request $request, Transaction $transaction)
    {
        $this->authorizeDocument($request->user(), $transaction);

        if (!$request->user()->hasAnyPermission(['record_finance_payments', 'manage_finance'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'payment_reference' => ['nullable', 'string', 'max:191'],
            'finance_note' => ['nullable', 'string', 'max:1000'],
        ]);

        $outstanding = round((float) $transaction->grand_total - (float) $transaction->paid_amount, 2);

        if ($outstanding <= 0) {
            return response()->json(['message' => 'This document is already fully settled.'], 422);
        }

        if (round((float) $data['amount'], 2) > $outstanding) {
            return response()->json([
                'message' => 'Payment exceeds the outstanding balance of '.number_format($outstanding, 2).'.',
            ], 422);
        }

        $before = [
            'paid_amount' => (float) $transaction->paid_amount,
            'due_amount' => (float) $transaction->due_amount,
            'payment_status' => $transaction->payment_status,
        ];

        DB::transaction(function () use ($transaction, $data, $request) {
            $transaction->paid_amount = round((float) $transaction->paid_amount + (float) $data['amount'], 2);
            $transaction->payment_method = $data['payment_method'] ?? $transaction->payment_method;
            $transaction->payment_reference = $data['payment_reference'] ?? $transaction->payment_reference;
            $transaction->finance_note = $data['finance_note'] ?? $transaction->finance_note;
            $transaction->last_payment_at = now();
            $transaction->settled_by = $request->user()->name;
            $transaction->syncPaymentState();
            $transaction->save();
        });

        AuditLogger::log([
            'hospital_id' => $transaction->hospital_id,
            'module' => 'Pharmacy Finance',
            'action' => 'payment',
            'record_id' => $transaction->id,
            'record_label' => $transaction->trx_type.' #'.$transaction->serial_no,
            'old_values' => $before,
            'new_values' => [
                'paid_amount' => (float) $transaction->paid_amount,
                'due_amount' => (float) $transaction->due_amount,
                'payment_status' => $transaction->payment_status,
            ],
            'description' => 'Recorded payment of '.number_format((float) $data['amount'], 2),
        ]);

        return response()->json($transaction->fresh());
    }

    /**
     * Manually override payment terms/status (e.g. mark a document pending again).
     */
    public function updateStatus(Request $request, Transaction $transaction)
    {
        $this->authorizeDocument($request->user(), $transaction);

        if (!$request->user()->hasAnyPermission(['edit_finance_payment_status', 'manage_finance'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $data = $request->validate([
            'payment_status' => ['nullable', Rule::in(['pending', 'partial', 'paid'])],
            'payment_due_date' => ['nullable', 'date'],
            'payment_method' => ['nullable', 'string', 'max:50'],
            'payment_reference' => ['nullable', 'string', 'max:191'],
            'finance_note' => ['nullable', 'string', 'max:1000'],
        ]);

        // Recording that money arrived and undoing that record are different
        // acts: one is the counter's daily work, the other corrects it. Sharing
        // a permission meant whoever could take a payment could also make it
        // disappear.
        $next = $data['payment_status'] ?? null;
        $wasPaid = (string) $transaction->payment_status === 'paid';

        // Marking paid is covered by edit_finance_payment_status, already
        // required above -- a desk that may set the status is the desk that
        // settles documents. Only the reversal needs a right of its own.
        if ($wasPaid && in_array($next, ['pending', 'partial'], true)
            && !$request->user()->hasAnyPermission(['reverse_finance_payment', 'manage_finance'])) {
            return response()->json([
                'message' => 'Reversing a settled invoice requires the Reverse Finance Payment permission.',
            ], 403);
        }

        $before = [
            'payment_status' => $transaction->payment_status,
            'paid_amount' => (float) $transaction->paid_amount,
            'payment_due_date' => optional($transaction->payment_due_date)->toDateString(),
        ];

        DB::transaction(function () use ($transaction, $data, $request) {
            foreach (['payment_due_date', 'payment_method', 'payment_reference', 'finance_note'] as $field) {
                if (array_key_exists($field, $data)) {
                    $transaction->{$field} = $data[$field];
                }
            }

            // Keep amounts and status consistent: forcing a status rewrites the
            // paid amount so the two can never disagree in reports.
            if (!empty($data['payment_status'])) {
                if ($data['payment_status'] === 'paid') {
                    $transaction->paid_amount = $transaction->grand_total;
                } elseif ($data['payment_status'] === 'pending') {
                    $transaction->paid_amount = 0;
                }

                $transaction->syncPaymentState();

                if ($data['payment_status'] === 'partial') {
                    $transaction->payment_status = 'partial';
                }
            }

            // The moment the money was recorded, which the daily handover and
            // the dashboard report on. Cleared on reversal so a reversed
            // document does not keep a settlement date.
            if ((string) $transaction->payment_status === 'paid') {
                $transaction->last_payment_at = now();
            } elseif (in_array((string) $transaction->payment_status, ['pending', 'partial'], true)
                && (float) $transaction->paid_amount <= 0) {
                $transaction->last_payment_at = null;
            }

            $transaction->settled_by = $request->user()->name;
            $transaction->save();
        });

        AuditLogger::log([
            'hospital_id' => $transaction->hospital_id,
            'module' => 'Pharmacy Finance',
            'action' => 'update',
            'record_id' => $transaction->id,
            'record_label' => $transaction->trx_type.' #'.$transaction->serial_no,
            'old_values' => $before,
            'new_values' => [
                'payment_status' => $transaction->payment_status,
                'paid_amount' => (float) $transaction->paid_amount,
                'payment_due_date' => optional($transaction->payment_due_date)->toDateString(),
            ],
            'description' => 'Updated payment terms.',
        ]);

        return response()->json($transaction->fresh());
    }

    /**
     * Unpaginated feed for Excel/PDF export on the client.
     */
    public function export(Request $request)
    {
        $user = $request->user();
        $allowedTypes = $this->allowedTypes($user);

        if (empty($allowedTypes) || !$user->hasAnyPermission(['export_finance', 'manage_finance'])) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        $rows = $this->scopedQuery($request, $allowedTypes)
            ->orderByDesc('created_at')
            ->limit(10000)
            ->get();

        AuditLogger::log([
            'module' => 'Pharmacy Finance',
            'action' => 'export',
            'description' => 'Exported '.$rows->count().' finance records.',
        ]);

        return response()->json($rows);
    }

    /**
     * Document types the user is allowed to see.
     *
     * @return array<int, string>
     */
    private function allowedTypes($user): array
    {
        $allowed = [];

        foreach (self::TYPE_PERMISSIONS as $type => $permissions) {
            if ($user->hasAnyPermission($permissions)) {
                $allowed[] = $type;
            }
        }

        return $allowed;
    }

    /**
     * @param  array<int, string>  $allowedTypes
     */
    private function scopedQuery(Request $request, array $allowedTypes)
    {
        $user = $request->user();

        $query = Transaction::query()->whereIn('trx_type', $allowedTypes);

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        // A requested type still has to be one the user may see.
        if ($request->filled('trx_type') && in_array($request->string('trx_type')->toString(), $allowedTypes, true)) {
            $query->where('trx_type', $request->string('trx_type'));
        }

        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->string('payment_status'));
        }

        if ($request->filled('start_date')) {
            $query->whereDate('created_at', '>=', $request->string('start_date'));
        }

        if ($request->filled('end_date')) {
            $query->whereDate('created_at', '<=', $request->string('end_date'));
        }

        if ($request->boolean('overdue_only')) {
            $query->where('due_amount', '>', 0)->whereDate('payment_due_date', '<', now()->toDateString());
        }

        if ($request->filled('search')) {
            $term = '%'.$request->string('search').'%';
            $query->where(function ($q) use ($term) {
                $q->where('patient_name', 'like', $term)
                    ->orWhere('supplier_name', 'like', $term)
                    ->orWhere('serial_no', 'like', $term)
                    ->orWhere('payment_reference', 'like', $term)
                    ->orWhere('finance_note', 'like', $term);
            });
        }

        return $query;
    }

    private function authorizeDocument($user, Transaction $transaction): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $transaction->hospital_id) {
            abort(403, 'Unauthorized transaction access');
        }

        $permissions = self::TYPE_PERMISSIONS[$transaction->trx_type] ?? [];

        if (empty($permissions) || !$user->hasAnyPermission($permissions)) {
            abort(403, 'You do not have access to this document type.');
        }
    }
}
