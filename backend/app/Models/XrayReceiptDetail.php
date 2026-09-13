<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * One study on an X-Ray receipt.
 *
 * The name and fee are copied from the catalogue when the line is billed, so a
 * study renamed or repriced later cannot rewrite a receipt already printed.
 */
class XrayReceiptDetail extends Model
{
    protected $fillable = [
        'xray_receipt_id',
        'xray_type_id',
        'study_name',
        'fee',
        'sort_order',
    ];

    protected $casts = [
        'fee' => 'decimal:2',
        'sort_order' => 'integer',
    ];

    public function receipt()
    {
        return $this->belongsTo(XrayReceipt::class, 'xray_receipt_id');
    }

    public function xrayType()
    {
        return $this->belongsTo(XrayType::class);
    }
}
