<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One service on a dental receipt.
 *
 * The name and fee are copied from the catalogue when the line is billed, so a
 * service renamed or repriced later cannot rewrite a receipt already printed.
 */
class DentalReceiptDetail extends Model
{
    protected $fillable = [
        'dental_receipt_id',
        'dental_service_id',
        'service_name',
        'fee',
        'sort_order',
    ];

    protected $casts = [
        'fee' => 'decimal:2',
        'sort_order' => 'integer',
    ];

    public function receipt()
    {
        return $this->belongsTo(DentalReceipt::class, 'dental_receipt_id');
    }

    public function dentalService()
    {
        return $this->belongsTo(DentalService::class);
    }
}
