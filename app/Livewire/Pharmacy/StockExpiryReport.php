<?php

namespace App\Livewire\Pharmacy;

use App\Models\Pharmacy\Product;
use App\Models\Pharmacy\Stock as PharmacyStock;
use Livewire\Component;
use Illuminate\Support\Facades\Auth;
use Livewire\WithFileUploads;
use Livewire\WithPagination;
use Barryvdh\DomPDF\PDF;
use Maatwebsite\Excel\Facades\Excel;
use Carbon\Carbon;

class StockExpiryReport extends Component
{
    use WithFileUploads, WithPagination;

    // Stock fields
    public $product_id, $batch_no, $mfg_date, $expiry_date, $quantity, $unit_price;

    // Search by: Product, Batch No, Expiry Range
    public $searchByProduct = '', $searchByBatchNo = '', $searchByExpiryStatus = '';
    public $searchResults = [];

    // Dynamic search fields
    public $search = '';
    public $isOpen = 0;
    public $selectedStock;

    protected $paginationTheme = 'bootstrap';

    public $searchFromDate, $searchToDate;

    public function searchDetails()
    {
        $query = PharmacyStock::with(['product', 'user']);

        if (!empty($this->searchByProduct)) {
            $query->where('product_id', $this->searchByProduct);
        } elseif (!empty($this->searchByBatchNo)) {
            $query->where('batch_no', $this->searchByBatchNo);
        }

        if (!empty($this->searchByExpiryStatus)) {
            $today = Carbon::today();
            $thirtyDaysLater = Carbon::today()->addDays(30);
            $sixtyDaysLater = Carbon::today()->addDays(60);

            switch ($this->searchByExpiryStatus) {
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

        if (!empty($this->searchFromDate) && !empty($this->searchToDate)) {
            $query->whereBetween('expiry_date', [$this->searchFromDate, $this->searchToDate]);
        }

        $this->searchResults = $query->get();
        // Use JS dispatch in Livewire v3 format
        $this->dispatch('open-modal', 'searchModal');
    }

    public function closeSearchModal()
    {
        $this->selectedStock = null;
        $this->dispatch('close-modal', 'searchModal');
    }

    public function resetFilters()
    {
        $this->searchByProduct = '';
        $this->searchByBatchNo = '';
        $this->searchByExpiryStatus = '';
        $this->selectedStock = null;
        $this->searchResults = [];
        $this->searchFromDate = '';
        $this->searchToDate = '';
        $this->search = '';
    }

    public function showDetails($id)
    {
        $this->selectedStock = PharmacyStock::with(['product', 'user'])->findOrFail($id);
        $this->dispatch('open-modal', 'detailsModal');
    }

    public function closeDetailsModal()
    {
        $this->selectedStock = null;
        $this->dispatch('close-modal', 'detailsModal');
    }

    public function updatingSearch()
    {
        $this->resetPage(); // Reset pagination when search query is updated
    }

    public function getExpiryStatusAttribute($stockItem)
    {
        $today = Carbon::today();
        $expiryDate = Carbon::parse($stockItem->expiry_date);
        $daysRemaining = $today->diffInDays($expiryDate, false);

        if ($daysRemaining < 0) {
            return 'Expired';
        } elseif ($daysRemaining <= 30) {
            return 'About to Expire';
        } elseif ($daysRemaining <= 90) {
            return 'Near Expiration';
        } else {
            return 'Good Condition';
        }
    }

    public function getExpiryStatusClass($stockItem)
    {
        $today = Carbon::today();
        $expiryDate = Carbon::parse($stockItem->expiry_date);
        $daysRemaining = $today->diffInDays($expiryDate, false);

        if ($daysRemaining < 0) {
            return 'text-danger';
        } elseif ($daysRemaining <= 30) {
            return 'text-warning';
        } elseif ($daysRemaining <= 60) {
            return 'text-info';
        } else {
            return 'text-success';
        }
    }

    public function render()
    {
        $products = Product::where('is_active', 1)->get();
        
        // Build the query for stocks with expiry date info
        $query = PharmacyStock::with(['product', 'user']);

        // Add a search filter
        if ($this->search) {
            $query->where(function ($query) {
                $query->whereHas('product', function ($subQuery) {
                    $subQuery->where('name', 'like', '%' . $this->search . '%');
                })
                ->orWhere('batch_no', 'like', '%' . $this->search . '%')
                ->orWhereRaw("DATE_FORMAT(expiry_date, '%d-%m-%Y') like ?", ['%' . $this->search . '%']);
            });
        }

        // Order by expiry date to prioritize soon-to-expire items
        $query->orderBy('expiry_date', 'asc');

        // Check if search is empty, then paginate, otherwise get all results
        if (empty($this->search)) {
            $stocks = $query->paginate(25); // Paginate results (adjust as needed)
        } else {
            $stocks = $query->get(); // Get all results without pagination
        }

        // Calculate expiry statistics
        $today = Carbon::today();
        $thirtyDaysLater = Carbon::today()->addDays(30);
        $sixtyDaysLater = Carbon::today()->addDays(60);

        $expiredCount = PharmacyStock::where('expiry_date', '<', $today)
            ->count();

        $aboutToExpireCount = PharmacyStock::whereBetween('expiry_date', [$today, $thirtyDaysLater])
            ->count();

        $nearExpirationCount = PharmacyStock::whereBetween('expiry_date', [$thirtyDaysLater->addDay(), $sixtyDaysLater])
            ->count();

        $goodConditionCount = PharmacyStock::where('expiry_date', '>', $sixtyDaysLater)
            ->count();

        return view('livewire.pharmacy.stock-expiry-report', [
            'stocks' => $stocks, 
            'products' => $products,
            'expiredCount' => $expiredCount,
            'aboutToExpireCount' => $aboutToExpireCount,
            'nearExpirationCount' => $nearExpirationCount,
            'goodConditionCount' => $goodConditionCount,
        ]);
    }

    // export as PDF
    public function pdf()
    {
        $query = $this->buildExportQuery();
        $stocks = $query->get();

        $pdf = app(PDF::class)->loadView('livewire.pharmacy.stock-expiry-report-pdf', ['stocks' => $stocks]);

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->stream();
        }, 'stock-expiry-report.pdf');
    }

    // print logic
    public function print()
    {
        // Store search filters in session for printing
        session()->put('print_filters', [
            'searchByProduct' => $this->searchByProduct,
            'searchByBatchNo' => $this->searchByBatchNo,
            'searchByExpiryStatus' => $this->searchByExpiryStatus,
            'searchFromDate' => $this->searchFromDate,
            'searchToDate' => $this->searchToDate,
        ]);
        
        // Dispatch event to open print window
        $this->dispatch('print-stock-expiry-report');
    }

    // export to Excel
    public function excel()
    {
        $query = $this->buildExportQuery();
        $stocks = $query->get();

        return Excel::download(new class($stocks) implements \Maatwebsite\Excel\Concerns\FromCollection, \Maatwebsite\Excel\Concerns\WithHeadings {
            protected $stocks;

            public function __construct($stocks)
            {
                $this->stocks = $stocks->map(function ($stock) {
                    $today = \Carbon\Carbon::today();
                    $expiryDate = \Carbon\Carbon::parse($stock->expiry_date);
                    $daysRemaining = $today->diffInDays($expiryDate, false);
                    
                    $status = 'Good Condition';
                    if ($daysRemaining < 0) {
                        $status = 'Expired';
                    } elseif ($daysRemaining <= 30) {
                        $status = 'About to Expire';
                    } elseif ($daysRemaining <= 90) {
                        $status = 'Near Expiration';
                    }
                    
                    return [
                        'id' => $stock->id,
                        'product_name' => $stock->product->name ?? 'N/A',
                        'batch_no' => $stock->batch_no,
                        'mfg_date' => $stock->mfg_date ? date('d-m-Y', strtotime($stock->mfg_date)) : 'N/A',
                        'expiry_date' => $stock->expiry_date ? date('d-m-Y', strtotime($stock->expiry_date)) : 'N/A',
                        'days_remaining' => $daysRemaining > 0 ? $daysRemaining : 0,
                        'expiry_status' => $status,
                        'quantity' => $stock->quantity,
                        'unit_price' => $stock->unit_price,
                        'created_by' => $stock->user->name ?? 'N/A',
                        'created_at' => $stock->created_at ? date('d-m-Y', strtotime($stock->created_at)) : 'N/A',
                    ];
                });
            }

            public function collection()
            {
                return collect($this->stocks);
            }

            public function headings(): array
            {
                return [
                    'ID',
                    'Product Name',
                    'Batch No',
                    'Mfg Date',
                    'Expiry Date',
                    'Days Remaining',
                    'Expiry Status',
                    'Quantity',
                    'Unit Price',
                    'Created By',
                    'Created At',
                ];
            }
        }, 'stock-expiry-report.xlsx');
    }

    private function buildExportQuery()
    {
        $query = PharmacyStock::with(['product', 'user']);

        if (!empty($this->searchByProduct)) {
            $query->where('product_id', $this->searchByProduct);
        }
        
        if (!empty($this->searchByBatchNo)) {
            $query->where('batch_no', $this->searchByBatchNo);
        }

        if (!empty($this->searchByExpiryStatus)) {
            $today = Carbon::today();
            $thirtyDaysLater = Carbon::today()->addDays(30);
            $sixtyDaysLater = Carbon::today()->addDays(60);

            switch ($this->searchByExpiryStatus) {
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

        if (!empty($this->searchFromDate) && !empty($this->searchToDate)) {
            $query->whereBetween('expiry_date', [$this->searchFromDate, $this->searchToDate]);
        }

        return $query->orderBy('expiry_date', 'asc');
    }
}