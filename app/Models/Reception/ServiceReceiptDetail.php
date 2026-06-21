<?php

namespace App\Models\Reception;

use App\Models\General\Service;
use App\Models\General\ServiceType;
use App\Models\Laboratory\TestDetail;
use App\Models\Reception\ServiceReceipt;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ServiceReceiptDetail extends Model
{
    use HasFactory;

    protected $fillable = [
        'service_receipt_id',
        'service_id',
        'service_type_id',
        'lab_test_status',
        'quantity',
        'price',
        'total',
    ];

    public function service_receipt()
    {
        return $this->belongsTo(ServiceReceipt::class, 'service_receipt_id');
    }

    public function service()
    {
        return $this->belongsTo(Service::class, 'service_id');
    }

    public function service_type()
    {
        return $this->belongsTo(ServiceType::class, 'service_type_id');
    }
    
    public function test_details()
    {
        return $this->hasMany(TestDetail::class, 'test_type_id', 'service_id');
    }
}
