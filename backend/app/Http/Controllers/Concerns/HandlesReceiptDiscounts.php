<?php

namespace App\Http\Controllers\Concerns;

use App\Services\DiscountService;
use Illuminate\Http\Request;

/**
 * The discount half of a receipt, written once.
 *
 * X-Ray and surgery each grew their own copy of this pair of methods, and they
 * had already drifted in small ways. Lab, ultrasound and room bookings now need
 * the same behaviour, so it lives here rather than becoming five copies.
 *
 * Two separate concerns, deliberately kept apart:
 *
 *  - who may discount at all, which is a permission and must be enforced on the
 *    server because a disabled input in a form is only a hint; and
 *  - what the discount comes to, which is arithmetic and must not be trusted
 *    from the request, or a stored row could claim 10% while holding a 90%
 *    discount amount.
 */
trait HandlesReceiptDiscounts
{
    /**
     * Strip any discount from the payload unless the user is allowed one.
     *
     * On an update the existing values are put back rather than zeroed: a
     * receptionist without the right editing some other field on a discounted
     * receipt must not silently remove the discount a supervisor applied.
     */
    protected function enforceDiscountPermission(Request $request, array &$data, $existing = null): void
    {
        $user = $request->user();

        if (!$user || $user->role === 'super_admin') {
            return;
        }

        if ($user->hasAnyPermission(['add_discounts', 'edit_discounts', 'manage_discounts'])) {
            return;
        }

        $data['discount_enabled'] = (bool) ($existing->discount_enabled ?? false);
        $data['discount_percentage'] = (float) ($existing->discount_percentage ?? 0);
        $data['discount_amount'] = (float) ($existing->discount_amount ?? 0);
    }

    /**
     * Resolve gross, discount and net onto the payload.
     *
     * `$grossKey` is whatever the table calls its pre-discount figure -- `fee`
     * on a radiology receipt, `total_amount` on a lab order, `total_cost` on a
     * room booking.
     *
     * Note that discount_enabled is a FULL WAIVER, not a "discount is on" flag:
     * DiscountService reads it as charge-nothing. A standing percentage belongs
     * in discount_percentage.
     */
    protected function applyDiscountRules(array &$data, string $grossKey = 'fee'): void
    {
        $computed = app(DiscountService::class)->computeFeeTotals([
            'original_fee_amount' => $data[$grossKey] ?? 0,
            'discount_enabled' => $data['discount_enabled'] ?? false,
            'discount_percentage' => array_key_exists('discount_percentage', $data)
                && $data['discount_percentage'] !== null
                && $data['discount_percentage'] !== ''
                ? $data['discount_percentage']
                : null,
            'discount_amount' => $data['discount_amount'] ?? 0,
        ]);

        $gross = $computed['original_fee_amount'];

        $data[$grossKey] = $gross;
        $data['discount_enabled'] = (bool) ($data['discount_enabled'] ?? false);
        $data['discount_amount'] = $computed['discount_amount'];
        $data['net_amount'] = $computed['total_amount'];

        // Derived from the money rather than echoed back from the request, so
        // the percentage and the amount on a stored row can never disagree.
        $data['discount_percentage'] = $gross > 0
            ? round(($computed['discount_amount'] / $gross) * 100, 2)
            : 0.0;
    }

    /** The validation rules every discountable receipt shares. */
    protected function discountValidationRules(): array
    {
        return [
            'discount_enabled' => ['nullable', 'boolean'],
            'discount_percentage' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
