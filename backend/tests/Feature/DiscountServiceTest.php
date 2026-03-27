<?php

use App\Services\DiscountService;

test('full waive discount sets discount to original fee and total to zero', function () {
    $service = app(DiscountService::class);

    $result = $service->computeFeeTotals([
        'original_fee_amount' => 1500,
        'discount_enabled' => true,
        'discount_amount' => 200,
    ]);

    expect($result['original_fee_amount'])->toBe(1500.0)
        ->and($result['discount_amount'])->toBe(1500.0)
        ->and($result['total_amount'])->toBe(0.0);
});

test('disabled discount keeps total equal to original fee when no percentage provided', function () {
    $service = app(DiscountService::class);

    $result = $service->computeFeeTotals([
        'original_fee_amount' => 800,
        'discount_enabled' => false,
    ]);

    expect($result['discount_amount'])->toBe(0.0)
        ->and($result['total_amount'])->toBe(800.0);
});
