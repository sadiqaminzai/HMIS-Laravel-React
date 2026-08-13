<?php

/**
 * Which reporting desk owns each income module.
 *
 * Hospitals split financial responsibility differently. In most, one finance
 * officer at reception reconciles everything. In others the pharmacy takes its
 * own sales, or the lab keeps its own order income, and each person must see
 * their figures without seeing anyone else's.
 *
 * Rather than hard-coding "pharmacy sales belong to the pharmacy tab", each
 * income module is assigned to a desk here, per hospital, under
 * Settings > General > Report Ownership.
 *
 * This controls which Reports tab a module's money appears under. It does NOT
 * grant access on its own -- a user still needs the tab's own permission.
 */
return [

    /** The tabs a module can be assigned to. */
    'desks' => [
        'reception' => 'Reception / Finance',
        'pharmacy' => 'Pharmacy',
        'laboratory' => 'Laboratory',
        'radiology' => 'Radiology',
    ],

    /**
     * The income modules that can be reassigned, keyed by the `module` value
     * written to ledger_entries so the report can filter on it directly.
     */
    'modules' => [
        'pharmacy' => 'Medicine Sale',
        'appointments' => 'Appointment Fees',
        'laboratory' => 'Laboratory Fees',
        'radiology' => 'Ultrasound / Radiology Fees',
        'surgery' => 'Surgery Fees',
        'room_booking' => 'Room Booking Fees',
    ],

    /**
     * Defaults: one finance officer at reception handles everything except
     * pharmacy sales, which is the split hospitals ask for most often.
     */
    'owners' => [
        'pharmacy' => 'pharmacy',
        'appointments' => 'reception',
        'laboratory' => 'reception',
        'radiology' => 'reception',
        'surgery' => 'reception',
        'room_booking' => 'reception',
    ],

];
