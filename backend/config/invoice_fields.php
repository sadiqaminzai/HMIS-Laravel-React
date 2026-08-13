<?php

/**
 * Which optional columns each pharmacy invoice type shows on the entry form.
 *
 * The four invoice types do genuinely different work, so they need different
 * columns. A purchase has to record the batch, expiry and bonus the supplier
 * actually delivered. A counter sale does not: the batch and expiry are chosen
 * automatically by FIFO (nearest expiry first), so asking the salesperson to
 * type them again is both slower and a chance to get it wrong.
 *
 * Hiding a column never changes what is stored -- batch and expiry are still
 * resolved and saved behind the scenes. It only removes the input.
 *
 * These are the defaults for a hospital that has not configured anything under
 * Settings > Pharmacy > Invoice Fields.
 */
return [

    'fields' => ['batch', 'expiry', 'bonus', 'discount', 'tax'],

    'types' => [
        // Counter sale: driven by FIFO, kept to the minimum the cashier needs.
        // Discount stays on because retail counters routinely give one.
        'sales' => [
            'batch' => false,
            'expiry' => false,
            'bonus' => false,
            'discount' => true,
            'tax' => false,
        ],
        // Return In: the returned pack carries a batch and expiry that must go
        // back to the right lot.
        'sales_return' => [
            'batch' => true,
            'expiry' => true,
            'bonus' => false,
            'discount' => true,
            'tax' => false,
        ],
        // Goods received from a supplier: everything is recorded.
        'purchase' => [
            'batch' => true,
            'expiry' => true,
            'bonus' => true,
            'discount' => true,
            'tax' => true,
        ],
        // Return Out mirrors the purchase it reverses.
        'purchase_return' => [
            'batch' => true,
            'expiry' => true,
            'bonus' => true,
            'discount' => true,
            'tax' => true,
        ],
    ],

];
