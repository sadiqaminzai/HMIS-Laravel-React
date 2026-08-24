<?php

namespace App\Http\Controllers\Concerns;

use Illuminate\Http\Request;

/**
 * Shared shape for "money changed hands" across the reception modules.
 *
 * Appointments, surgeries and room bookings each settle their own way, but the
 * facts recorded are identical: what status the document is now in, how it was
 * paid, when, and by whom. Keeping that in one place is what lets the day-end
 * handover treat all five revenue modules with a single query -- three
 * controllers each inventing their own column habits is how attribution rots.
 *
 * The pending status differs by module (lab says 'unpaid', the rest say
 * 'pending'), so it is passed in rather than assumed.
 */
trait RecordsPaymentCollection
{
    /**
     * Attributes to write when a payment is taken.
     *
     * paid_by is the authenticated user, never a value from the request: the
     * whole point of the field is that it cannot be chosen by the caller.
     */
    protected function paymentCollectedAttributes(Request $request, ?string $paymentMethod = null): array
    {
        return [
            'payment_status' => 'paid',
            'payment_method' => $paymentMethod ?: 'cash',
            'paid_at' => now(),
            'paid_by' => $request->user()?->name,
            'updated_by' => $request->user()?->name,
        ];
    }

    /**
     * Attributes to write when a payment is reversed.
     *
     * The collector is cleared along with the timestamp. Leaving a stale
     * paid_by behind would keep the money in that person's handover after it
     * had been taken back out of their drawer.
     */
    protected function paymentReversedAttributes(Request $request, string $pendingStatus = 'pending'): array
    {
        return [
            'payment_status' => $pendingStatus,
            'paid_at' => null,
            'paid_by' => null,
            'updated_by' => $request->user()?->name,
        ];
    }

    /** Payment methods a counter can actually take money in. */
    protected function paymentMethodRule(): array
    {
        return ['nullable', 'string', 'max:50'];
    }

    /**
     * Keep the collection fields honest when payment_status rides in on a
     * general update() rather than through the payment endpoints.
     *
     * The edit forms still carry a payment_status select. Left alone, a clerk
     * saving that form could move a document to paid with no paid_by attached,
     * and the money would land in the handover's Unattributed row -- exactly the
     * hole the payment endpoints were added to close. Rather than trusting every
     * caller to remember, the transition itself is what stamps the collector.
     *
     * Only transitions are touched: re-saving a document that was already paid
     * must not re-stamp it, or an unrelated edit would quietly move yesterday's
     * cash to whoever opened the form today.
     */
    protected function syncPaymentCollection(Request $request, array $data, ?object $existing = null): array
    {
        if (!array_key_exists('payment_status', $data)) {
            return $data;
        }

        $next = (string) $data['payment_status'];
        $wasPaid = (string) ($existing->payment_status ?? '') === 'paid';

        if ($next === 'paid' && !$wasPaid) {
            $data['paid_at'] = now();
            $data['paid_by'] = $request->user()?->name;
        } elseif ($next !== 'paid' && $wasPaid) {
            $data['paid_at'] = null;
            $data['paid_by'] = null;
        }

        return $data;
    }
}
