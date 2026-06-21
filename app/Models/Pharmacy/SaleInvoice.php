<?php

namespace App\Models\Pharmacy;

use App\Models\General\Discount;
use App\Models\General\Employee;
use App\Models\Reception\Patient;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SaleInvoice extends Model
{
    use HasFactory;

    protected $fillable = [
        'patient_id',
        'doctor_id',
        'invoice_no',
        'invoice_date',
        'print_date',
        'total_amount',
        'total_discount',
        'total_quantity',
        'net_amount',
        'paid_amount',
        'due_amount',
        'discount_id',
        'discount_reason',
        'payment_status',
        'payment_method',
        'created_by',
        'updated_by',
        'deleted_by',
        'is_active',
        'is_delete',
    ];

    public function saleInvoiceDetails()
    {
        return $this->hasMany(SaleInvoiceDetail::class, 'sale_invoice_id');
    }

    public function patient()
    {
        return $this->belongsTo(Patient::class, 'patient_id');
    }

    //stocks
    public function stock()
    {
        return $this->hasMany(Stock::class, 'sale_invoice_id');
    }

    public function discount()
    {
        return $this->belongsTo(Discount::class, 'discount_id');
    }

    public function doctor()
    {
        return $this->belongsTo(Employee::class, 'doctor_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
