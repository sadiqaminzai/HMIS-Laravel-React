<?php

/**
 * Print paper size configuration.
 *
 * Each printable document in the system is configured independently, because a
 * hospital typically mixes paper: thermal mini-printer receipts at the counter,
 * A4 for purchase invoices and discharge summaries, card stock for patient cards.
 *
 * The values below are the defaults applied to a hospital that has not yet
 * configured anything under Settings > General > Print Settings.
 */
return [

    'sizes' => ['a4', 'a5', '80mm', '76mm', '58mm'],

    'modules' => [
        'pharmacy_sales_invoice' => '80mm',
        'pharmacy_purchase_invoice' => 'a4',
        // Return In (sales return) is a counter receipt; Return Out (purchase return)
        // carries batch/bonus/expiry detail and needs a full page.
        'pharmacy_sales_return_invoice' => '80mm',
        'pharmacy_purchase_return_invoice' => 'a4',
        'patient_card' => 'a4',
        'appointment_receipt' => '80mm',
        'lab_invoice' => '80mm',
        'lab_report' => 'a4',
        'surgery_receipt' => '80mm',
        'surgery_discharge_summary' => 'a4',
        'room_booking_receipt' => '80mm',
        'expense_receipt' => 'a4',
        'other_income_receipt' => 'a4',
        'prescription' => 'a4',
    ],

];
