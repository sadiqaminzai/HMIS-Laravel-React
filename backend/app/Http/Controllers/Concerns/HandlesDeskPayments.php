<?php

namespace App\Http\Controllers\Concerns;

use App\Models\HospitalSetting;
use Illuminate\Http\Request;

/**
 * Who may collect at a desk, and what a new receipt's payment starts as.
 *
 * Shared by the Ultrasound, X-Ray, ECG and Dental desks so the four answer both
 * questions the same way.
 *
 * Two routes to the same endpoint. Accounts > Payment Collection holds the
 * `manage_*_payments` / `reverse_*_payment` rights; a desk's own Take Payment
 * and Return Payment buttons hold `take_*_payment` / `return_*_payment`. The
 * endpoint accepts either, so a collector never needs both -- but managing a
 * desk's records no longer implies either, which is how a radiologist came to
 * be recorded as the cashier on ninety receipts.
 */
trait HandlesDeskPayments
{
    /** May this user take money for this desk, from either screen? */
    protected function canCollectFor(Request $request, string $desk): bool
    {
        $user = $request->user();

        return $user !== null && (
            $user->role === 'super_admin'
            || $user->hasAnyPermission(["take_{$desk}_payment", "manage_{$desk}_payments"])
        );
    }

    /** May this user put a collected payment back, from either screen? */
    protected function canReturnFor(Request $request, string $desk): bool
    {
        $user = $request->user();

        return $user !== null && (
            $user->role === 'super_admin'
            || $user->hasAnyPermission(["return_{$desk}_payment", "reverse_{$desk}_payment"])
        );
    }

    /**
     * Mark a brand-new receipt paid, when the hospital says its fees are taken
     * at the counter.
     *
     * Configured under Settings > General > Default Payment Status. Honoured
     * only for a user who may collect for this desk, exactly as the laboratory
     * default already is: a standing "starts as paid" must not become a way
     * for someone without the right to record money as received.
     *
     * $payable is the net after discount -- a fully waived receipt has nothing
     * to collect and stays as it is.
     */
    protected function applyDefaultPayment(Request $request, array &$data, int $hospitalId, string $desk, float $payable): void
    {
        if ($payable <= 0 || !$this->startsPaid($hospitalId, $desk) || !$this->canCollectFor($request, $desk)) {
            return;
        }

        $data['payment_status'] = 'paid';
        $data['paid_amount'] = round($payable, 2);
        $data['payment_method'] = 'cash';
        $data['paid_at'] = now();
        $data['paid_by'] = $request->user()?->name;
    }

    /**
     * The hospital's configured default for one desk.
     *
     * Every desk key lives in default_payment_statuses, beside the appointment
     * and pharmacy defaults already stored there. Anything but an explicit
     * 'paid' means pending, so money is only ever recorded as received where
     * the hospital has said so.
     */
    protected function startsPaid(int $hospitalId, string $desk): bool
    {
        if ($hospitalId <= 0) {
            return false;
        }

        $defaults = HospitalSetting::where('hospital_id', $hospitalId)->value('default_payment_statuses');
        $defaults = is_string($defaults) ? json_decode($defaults, true) : $defaults;

        return is_array($defaults) && ($defaults[$desk] ?? 'pending') === 'paid';
    }
}
