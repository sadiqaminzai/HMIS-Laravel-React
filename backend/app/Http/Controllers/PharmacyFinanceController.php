<?php

namespace App\Http\Controllers;

use App\Models\Transaction;
use App\Services\AuditLogger;
use App\Services\LedgerPostingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

/**
 * Settlement of pharmacy documents.
 *
 * This used to back a Pharmacy Finance SCREEN as well -- a list of invoices,
 * purchases and returns with its own filters, summary and export. That screen
 * is gone: Payment Collection already lists pharmacy invoices next to every
 * other module's unpaid charges, which is how a cashier actually works, and
 * two lists of the same rows meant two places to look and two chances to
 * disagree.
 *
 * What remains is the pair of endpoints Payment Collection settles through, so
 * a pharmacy payment is still recorded here, still posts to the ledger, and
 * still checks the document-type permission before it does either. Deleting
 * them would silently break settling any pharmacy invoice.
 */
class PharmacyFinanceController extends Controller
{
    public function __construct(private readonly LedgerPostingService $ledgerPostingService)
    {
    }

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

            // Every other module reposts its snapshot when money moves; pharmacy
            // did not, so the ledger kept showing settled invoices as owing and
            // the collection desk offered charges that could not be taken.
            $this->ledgerPostingService->upsertTransactionSnapshot($transaction);
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

            // Reversing here clears the collector, so the money leaves that
            // person's handover at the same moment it leaves the document.
            $transaction->settled_by = (string) $transaction->payment_status === 'pending'
                && (float) $transaction->paid_amount <= 0
                    ? null
                    : $request->user()->name;
            $transaction->save();

            $this->ledgerPostingService->upsertTransactionSnapshot($transaction);
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
