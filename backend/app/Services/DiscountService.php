<?php

namespace App\Services;

class DiscountService
{
    public function computeFeeTotals(array $payload): array
    {
        $original = round(max(0, (float) ($payload['original_fee_amount'] ?? 0)), 2);
        $discountEnabled = (bool) ($payload['discount_enabled'] ?? false);

        if ($discountEnabled) {
            return [
                'original_fee_amount' => $original,
                'discount_amount' => $original,
                'total_amount' => 0.00,
            ];
        }

        $percentage = isset($payload['discount_percentage']) ? (float) $payload['discount_percentage'] : null;
        $manualDiscount = round(max(0, (float) ($payload['discount_amount'] ?? 0)), 2);

        if ($percentage !== null) {
            $percentage = min(100, max(0, $percentage));
            $manualDiscount = round(($original * $percentage) / 100, 2);
        }

        $discount = min($original, $manualDiscount);
        $total = round(max(0, $original - $discount), 2);

        return [
            'original_fee_amount' => $original,
            'discount_amount' => $discount,
            'total_amount' => $total,
        ];
    }
}
