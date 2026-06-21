<?php

namespace App\Http\Controllers\Routes;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class PharmacyController extends Controller
{
    public function company()
    {
        return view('pharmacy.company');
    }
    public function supplier()
    {
        return view('pharmacy.supplier');
    }
    public function packing()
    {
        return view('pharmacy.packing');
    }
    public function product()
    {
        return view('pharmacy.product');
    }
    public function stock()
    {
        return view('pharmacy.stock');
    }
    public function purchase()
    {
        return view('pharmacy.purchase');
    }
    public function sale_invoice()
    {
        return view('pharmacy.sale-invoice');
    }
    public function return_invoice()
    {
        return view('pharmacy.return-invoice');
    }
    
    public function stock_expiry_report()
    {
        return view('pharmacy.stock-expiry-report');
    }

    public function stock_quantity_report()
    {
        return view('pharmacy.stock-quantity-report');
    }

    public function stock_expiry_report_print()
    {
        // Get filters from session
        $filters = session('print_filters', []);
        // Build query based on filters
        $query = \App\Models\Pharmacy\Stock::with(['product', 'user']);

        if (!empty($filters['searchByProduct'])) {
            $query->where('product_id', $filters['searchByProduct']);
        }
        
        if (!empty($filters['searchByBatchNo'])) {
            $query->where('batch_no', $filters['searchByBatchNo']);
        }

        if (!empty($filters['searchByExpiryStatus'])) {
            $today = \Carbon\Carbon::today();
            $thirtyDaysLater = \Carbon\Carbon::today()->addDays(30);
            $sixtyDaysLater = \Carbon\Carbon::today()->addDays(60);

            switch ($filters['searchByExpiryStatus']) {
                case 'expired':
                    $query->where('expiry_date', '<', $today);
                    break;
                case 'about_to_expire':
                    $query->whereBetween('expiry_date', [$today, $thirtyDaysLater]);
                    break;
                case 'near_expiration':
                    $query->whereBetween('expiry_date', [$thirtyDaysLater->addDay(), $sixtyDaysLater]);
                    break;
                case 'good_condition':
                    $query->where('expiry_date', '>', $sixtyDaysLater);
                    break;
            }
        }

        if (!empty($filters['searchFromDate']) && !empty($filters['searchToDate'])) {
            $query->whereBetween('expiry_date', [$filters['searchFromDate'], $filters['searchToDate']]);
        }

        $stocks = $query->orderBy('expiry_date', 'asc')->get();

        return view('livewire.pharmacy.stock-expiry-report-print', compact('stocks'));
    }
}
