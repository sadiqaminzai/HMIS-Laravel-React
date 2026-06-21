<?php

namespace App\Livewire\Pharmacy;

use App\Models\Pharmacy\Purchase as PharmacyPurchase;
use App\Models\Pharmacy\Supplier;
use App\Models\Pharmacy\Product;
use Livewire\Component;
use Livewire\WithPagination;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Auth;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;

class PurchaseReport extends Component
{
    use WithPagination;

    public $id, $purchase_no, $purchase_date, $supplier_name, $bilty_no, $invoice_no, 
        $total_amount, $total_discount, $total_quantity, $net_amount, $paid_amount, $due_amount,
        $created_by, $updated_by, $is_active, $is_delete;

    public $search_purchase_no, $search_purchase_date, $search_supplier_name, $searchFromDate, $searchToDate;
    public $searchFromId, $searchToId; // Added ID range search variables
    public $isOpen = 0;
    public $selectedPurchase;
    public $searchResults = [];
    public $totalNetAmount = 0;
    public $totalPaidAmount = 0;
    public $totalDueAmount = 0;

    protected $paginationTheme = 'bootstrap'; // To use Bootstrap for pagination
    
    public function showDetails($id)
    {
        $this->selectedPurchase = PharmacyPurchase::with(['supplier', 'user', 'purchaseDetails.product'])->findOrFail($id);
        $this->dispatch('open-modal', 'detailsModal');
    }
    
    public function closeDetailsModal()
    {
        $this->selectedPurchase = null;
        $this->dispatch('close-modal', 'detailsModal');
    }

    public function openModal()
    {
        $this->isOpen = true;
        $this->dispatch('open-modal');
    }

    public function closeModal()
    {
        $this->resetInputFields();
        $this->dispatch('close-modal');
    }

    private function resetInputFields()
    {
        $this->id = '';
        $this->purchase_no = '';
        $this->purchase_date = '';
        $this->supplier_name = '';
        $this->bilty_no = '';
        $this->invoice_no = '';
        $this->total_amount = '';
        $this->total_discount = '';
        $this->total_quantity = '';
        $this->net_amount = '';
        $this->paid_amount = '';
        $this->due_amount = '';
        $this->created_by = '';
        $this->updated_by = '';
        $this->is_active = '';
        $this->is_delete = '';
    }

    public function search()
    {
        $this->resetPage();
    }

    public function clearSearch()
    {
        $this->search_purchase_no = '';
        $this->search_purchase_date = '';
        $this->search_supplier_name = '';
        $this->searchFromDate = '';
        $this->searchToDate = '';
        $this->searchFromId = '';
        $this->searchToId = '';
        $this->resetPage();
    }

    public function searchDetails()
    {
        // Store search filters in session for printing
        session()->put('print_filters', [
            'search_purchase_no' => $this->search_purchase_no,
            'search_purchase_date' => $this->search_purchase_date,
            'search_supplier_name' => $this->search_supplier_name,
            'searchFromDate' => $this->searchFromDate,
            'searchToDate' => $this->searchToDate,
            'searchFromId' => $this->searchFromId,
            'searchToId' => $this->searchToId,
        ]);

        $query = PharmacyPurchase::with(['supplier', 'purchaseDetails.product'])
            ->where(function ($q) {
                if ($this->search_purchase_no) {
                    $q->where('purchase_no', 'like', '%' . $this->search_purchase_no . '%');
                }
                if ($this->search_purchase_date) {
                    $q->where('purchase_date', 'like', '%' . $this->search_purchase_date . '%');
                }
                if ($this->search_supplier_name) {
                    $q->whereHas('supplier', function ($q) {
                        $q->where('name', 'like', '%' . $this->search_supplier_name . '%');
                    });
                }
                if ($this->searchFromDate && $this->searchToDate) {
                    $q->whereBetween('purchase_date', [$this->searchFromDate, $this->searchToDate]);
                }
                if ($this->searchFromId && $this->searchToId) {
                    $q->whereBetween('id', [$this->searchFromId, $this->searchToId]);
                }
            })
            ->where('is_delete', 0)
            ->where('is_active', 1)
            ->orderBy('id', 'DESC')
            ->get();

        $this->searchResults = $query;
        $this->totalNetAmount = $query->sum('net_amount');
        $this->totalPaidAmount = $query->sum('paid_amount');
        $this->totalDueAmount = $query->sum('due_amount');

        $this->dispatch('open-search-modal');
    }

    public function closeSearchModal()
    {
        $this->dispatch('close-modal', 'searchModal');
    }

    public function render()
    {
        $query = PharmacyPurchase::query();

        if ($this->search_purchase_no) {
            $query->where('purchase_no', 'like', '%' . $this->search_purchase_no . '%');
        }

        if ($this->search_purchase_date) {
            $query->where('purchase_date', 'like', '%' . $this->search_purchase_date . '%');
        }

        if ($this->search_supplier_name) {
            $query->whereHas('supplier', function ($q) {
                $q->where('name', 'like', '%' . $this->search_supplier_name . '%');
            });
        }

        if ($this->searchFromDate && $this->searchToDate) {
            $query->whereBetween('purchase_date', [$this->searchFromDate, $this->searchToDate]);
        }
        
        if ($this->searchFromId && $this->searchToId) {
            $query->whereBetween('id', [$this->searchFromId, $this->searchToId]);
        }

        $purchases = $query->with(['supplier', 'purchaseDetails.product'])
            ->where('is_delete', 0)
            ->where('is_active', 1)
            ->orderBy('id', 'DESC')
            ->paginate(10);
        return view('livewire.pharmacy.purchase-report', [
            'purchases' => $purchases,
        ]);
    }

    public function excel()
    {
        // Apply the same filters as in the render method
        $query = PharmacyPurchase::query();

        if ($this->search_purchase_no) {
            $query->where('purchase_no', 'like', '%' . $this->search_purchase_no . '%');
        }

        if ($this->search_purchase_date) {
            $query->where('purchase_date', 'like', '%' . $this->search_purchase_date . '%');
        }

        if ($this->search_supplier_name) {
            $query->whereHas('supplier', function ($q) {
                $q->where('name', 'like', '%' . $this->search_supplier_name . '%');
            });
        }

        if ($this->searchFromDate && $this->searchToDate) {
            $query->whereBetween('purchase_date', [$this->searchFromDate, $this->searchToDate]);
        }
        
        if ($this->searchFromId && $this->searchToId) {
            $query->whereBetween('id', [$this->searchFromId, $this->searchToId]);
        }

        $purchases = $query->with('supplier')
            ->where('is_delete', 0)
            ->where('is_active', 1)
            ->orderBy('id', 'DESC')
            ->get();
        
        // Calculate totals
        $totalNetAmount = $purchases->sum('net_amount');
        $totalPaidAmount = $purchases->sum('paid_amount');
        $totalDueAmount = $purchases->sum('due_amount');
        
        // Add filename with date
        $filename = 'purchase_report_' . date('Y-m-d') . '.xlsx';
        
        // If no records found, show a message
        if ($purchases->isEmpty()) {
            session()->flash('message', 'No records found matching your search criteria.');
            return redirect()->back();
        }
        
        return Excel::download(new class($purchases, $totalNetAmount, $totalPaidAmount, $totalDueAmount) implements \Maatwebsite\Excel\Concerns\FromCollection, \Maatwebsite\Excel\Concerns\WithHeadings {
            protected $purchases;
            protected $totalNetAmount;
            protected $totalPaidAmount;
            protected $totalDueAmount;

            public function __construct($purchases, $totalNetAmount, $totalPaidAmount, $totalDueAmount)
            {
                $this->purchases = $purchases;
                $this->totalNetAmount = $totalNetAmount;
                $this->totalPaidAmount = $totalPaidAmount;
                $this->totalDueAmount = $totalDueAmount;
            }

            public function collection()
            {
                $data = $this->purchases->map(function ($purchase, $key) {
                    return [
                        'S.No' => $key + 1,
                        'Purchase No' => $purchase->purchase_no,
                        'Supplier Name' => $purchase->supplier->name ?? 'N/A',
                        'Purchase Date' => $purchase->purchase_date,
                        'Net Amount' => $purchase->net_amount,
                        'Paid Amount' => $purchase->paid_amount,
                        'Due Amount' => $purchase->due_amount,
                    ];
                });
                
                // Add empty row and totals row
                $data->push([
                    'S.No' => '',
                    'Purchase No' => '',
                    'Supplier Name' => '',
                    'Purchase Date' => '',
                    'Net Amount' => '',
                    'Paid Amount' => '',
                    'Due Amount' => '',
                ]);
                
                $data->push([
                    'S.No' => '',
                    'Purchase No' => '',
                    'Supplier Name' => '',
                    'Purchase Date' => 'Total:',
                    'Net Amount' => $this->totalNetAmount,
                    'Paid Amount' => $this->totalPaidAmount,
                    'Due Amount' => $this->totalDueAmount,
                ]);
                
                return $data;
            }

            public function headings(): array
            {
                return [
                    'S.No',
                    'Purchase No',
                    'Supplier Name',
                    'Purchase Date',
                    'Net Amount',
                    'Paid Amount',
                    'Due Amount',
                ];
            }
        }, $filename);
    }

    // Export as PDF functionality
    public function pdf()
    {
        // Create query based on search filters
        $query = PharmacyPurchase::with(['supplier', 'user'])
            ->where(function ($q) {
                if ($this->search_purchase_no) {
                    $q->where('purchase_no', 'like', '%' . $this->search_purchase_no . '%');
                }
                if ($this->search_purchase_date) {
                    $q->where('purchase_date', 'like', '%' . $this->search_purchase_date . '%');
                }
                if ($this->search_supplier_name) {
                    $q->whereHas('supplier', function ($q) {
                        $q->where('name', 'like', '%' . $this->search_supplier_name . '%');
                    });
                }
                if ($this->searchFromDate && $this->searchToDate) {
                    $q->whereBetween('purchase_date', [$this->searchFromDate, $this->searchToDate]);
                }
                if ($this->searchFromId && $this->searchToId) {
                    $q->whereBetween('id', [$this->searchFromId, $this->searchToId]);
                }
            })
            ->where('is_delete', 0)
            ->where('is_active', 1)
            ->orderBy('id', 'DESC')
            ->get();

        // Calculate totals
        $totalNetAmount = $query->sum('net_amount');
        $totalPaidAmount = $query->sum('paid_amount');
        $totalDueAmount = $query->sum('due_amount');

        // Generate PDF
        $pdf = Pdf::loadView('livewire.pharmacy.purchase_reports.pdf', [
            'purchases' => $query,
            'totalNetAmount' => $totalNetAmount,
            'totalPaidAmount' => $totalPaidAmount,
            'totalDueAmount' => $totalDueAmount
        ]);

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->stream();
        }, 'purchase-report.pdf');
    }

    // Print logic
    public function print()
    {
        // Get filters from session
        $filters = session('print_filters', []);

        // Build query based on filters
        $query = PharmacyPurchase::with(['supplier', 'user'])
            ->where(function ($q) use ($filters) {
                if (!empty($filters['search_purchase_no'])) {
                    $q->where('purchase_no', 'like', '%' . $filters['search_purchase_no'] . '%');
                }
                if (!empty($filters['search_purchase_date'])) {
                    $q->where('purchase_date', 'like', '%' . $filters['search_purchase_date'] . '%');
                }
                if (!empty($filters['search_supplier_name'])) {
                    $q->whereHas('supplier', function ($subQ) use ($filters) {
                        $subQ->where('name', 'like', '%' . $filters['search_supplier_name'] . '%');
                    });
                }
                if (!empty($filters['searchFromDate']) && !empty($filters['searchToDate'])) {
                    $q->whereBetween('purchase_date', [
                        Carbon::createFromFormat('Y-m-d', $filters['searchFromDate'])->startOfDay(),
                        Carbon::createFromFormat('Y-m-d', $filters['searchToDate'])->endOfDay(),
                    ]);
                }
                if (!empty($filters['searchFromId']) && !empty($filters['searchToId'])) {
                    $q->whereBetween('id', [$filters['searchFromId'], $filters['searchToId']]);
                }
            })
            ->where('is_delete', 0)
            ->where('is_active', 1)
            ->orderBy('id', 'DESC')
            ->get();
        
        // Calculate totals
        $totalNetAmount = $query->sum('net_amount');
        $totalPaidAmount = $query->sum('paid_amount');
        $totalDueAmount = $query->sum('due_amount');

        // Return view for printing
        return view('livewire.pharmacy.purchase_reports.print', compact('query', 'totalNetAmount', 'totalPaidAmount', 'totalDueAmount'));
    }
}