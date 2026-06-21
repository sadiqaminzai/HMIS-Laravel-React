<?php

namespace App\Livewire\Reports;

use App\Models\Reception\Patient;
use App\Models\General\Employee;
use App\Models\Reception\FeesReceipt;
use App\Models\Reception\ServiceReceipt;
use App\Models\Pharmacy\SaleInvoice;
use App\Models\Pharmacy\ReturnInvoice;
use App\Models\Pharmacy\Purchase;
use App\Models\Pharmacy\Supplier;
use Carbon\Carbon;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Collection;
use Livewire\Component;
use Livewire\WithPagination;
use Livewire\WithFileUploads;
use Maatwebsite\Excel\Facades\Excel;
use Barryvdh\DomPDF\Facade\Pdf;

class UnifiedReport extends Component
{
    use WithFileUploads, WithPagination;

    // Report type
    public $report_type = 'all';
    
    // Common search properties
    public $search = '';
    public $searchFromDate = '';
    public $searchToDate = '';
    public $searchById = '';
    public $searchFromId = '';
    public $searchToId = '';
    
    // Person related searches
    public $searchByPatient = '';
    public $searchByDoctor = '';
    public $searchBySupplier = '';
    
    // Invoice specific properties
    public $search_payment_status = '';
    public $search_payment_method = '';
    
    // Sorting
    public $sortField = 'date';
    public $sortDirection = 'desc';
    
    // Pagination
    protected $paginationTheme = 'bootstrap';
    public $perPage = 10;
    public $page = 1;
    
    // Selected data for view details
    public $selectedItem;
    public $viewType;

    // Reset all filters
    public function resetFilters()
    {
        $this->report_type = 'all';
        $this->search = '';
        $this->searchFromDate = '';
        $this->searchToDate = '';
        $this->searchById = '';
        $this->searchFromId = '';
        $this->searchToId = '';
        $this->searchByPatient = '';
        $this->searchByDoctor = '';
        $this->searchBySupplier = '';
        $this->search_payment_status = '';
        $this->search_payment_method = '';
        $this->resetPage();
    }
    
    // Handle page navigation
    public function setPage($page)
    {
        $this->page = $page;
    }
    
    public function updatingSearch()
    {
        $this->resetPage();
    }
    
    public function updatingReportType()
    {
        $this->resetPage();
    }
    
    public function updatingPerPage()
    {
        $this->resetPage();
    }
    
    public function sortBy($field)
    {
        if ($this->sortField === $field) {
            $this->sortDirection = $this->sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            $this->sortField = $field;
            $this->sortDirection = 'asc';
        }
        
        $this->resetPage();
    }

    public function showDetails($id, $type)
    {
        $this->viewType = $type;
        
        // Fetch the appropriate model based on type
        switch ($type) {
            case 'fee':
                $this->selectedItem = FeesReceipt::with('patient', 'employee', 'fees', 'user')->findOrFail($id);
                break;
            case 'service':
                $this->selectedItem = ServiceReceipt::with('patient', 'employee', 'service', 'user')->findOrFail($id);
                break;
            case 'sale':
                $this->selectedItem = SaleInvoice::with('patient', 'user', 'saleInvoiceDetails.product')->findOrFail($id);
                break;
            case 'return':
                $this->selectedItem = ReturnInvoice::with('patient', 'user', 'returnInvoiceDetails.product')->findOrFail($id);
                break;
            case 'purchase':
                $this->selectedItem = Purchase::with('supplier', 'user', 'purchaseDetails.product')->findOrFail($id);
                break;
        }
        
        $this->dispatch('open-modal', 'detailsModal');
    }

    public function closeDetailsModal()
    {
        $this->selectedItem = null;
        $this->viewType = null;
        $this->dispatch('close-modal', 'detailsModal');
    }
    
    // Get unified data for all report types
    private function getUnifiedData()
    {
        $data = collect();
        
        // Only get data for selected report types
        if ($this->report_type == 'all' || $this->report_type == 'fee') {
            $this->getFeeReceipts()->get()->each(function ($item) use (&$data) {
                $data->push([
                    'id' => $item->id,
                    'type' => 'fee',
                    'type_name' => 'Fee Receipt',
                    'date' => $item->created_at,
                    'number' => $item->id,
                    'patient_name' => $item->patient ? $item->patient->name : 'N/A',
                    'doctor_name' => $item->employee ? $item->employee->first_name . ' ' . $item->employee->last_name : 'N/A',
                    'supplier_name' => null,
                    'service_name' => $item->fees ? $item->fees->name : 'N/A',
                    'total_amount' => $item->total_amount,
                    'discount_amount' => $item->discount_amount,
                    'net_amount' => $item->total_amount - $item->discount_amount,
                    'paid_amount' => $item->total_amount - $item->discount_amount, // Fees are paid in full
                    'due_amount' => 0,
                    'payment_status' => 'Paid',
                    'user_name' => $item->user ? $item->user->name : 'N/A',
                    'raw_data' => $item
                ]);
            });
        }
        
        if ($this->report_type == 'all' || $this->report_type == 'service') {
            $this->getServiceReceipts()->get()->each(function ($item) use (&$data) {
                $data->push([
                    'id' => $item->id,
                    'type' => 'service',
                    'type_name' => 'Service Receipt',
                    'date' => $item->created_at,
                    'number' => $item->id,
                    'patient_name' => $item->patient ? $item->patient->name : 'N/A',
                    'doctor_name' => $item->employee ? $item->employee->first_name . ' ' . $item->employee->last_name : 'N/A',
                    'supplier_name' => null,
                    'service_name' => $item->service ? $item->service->name : 'N/A',
                    'total_amount' => $item->total_amount,
                    'discount_amount' => $item->discount_amount,
                    'net_amount' => $item->total_amount - $item->discount_amount,
                    'paid_amount' => $item->total_amount - $item->discount_amount, // Services are paid in full
                    'due_amount' => 0,
                    'payment_status' => 'Paid',
                    'user_name' => $item->user ? $item->user->name : 'N/A',
                    'raw_data' => $item
                ]);
            });
        }
        
        if ($this->report_type == 'all' || $this->report_type == 'sale') {
            $this->getSaleInvoices()->get()->each(function ($item) use (&$data) {
                $data->push([
                    'id' => $item->id,
                    'type' => 'sale',
                    'type_name' => 'Sale Invoice',
                    'date' => $item->invoice_date,
                    'number' => $item->invoice_no,
                    'patient_name' => $item->patient ? $item->patient->name : 'N/A',
                    'doctor_name' => null,
                    'supplier_name' => null,
                    'service_name' => null,
                    'total_amount' => $item->net_amount,
                    'discount_amount' => 0,
                    'net_amount' => $item->net_amount,
                    'paid_amount' => $item->paid_amount,
                    'due_amount' => $item->due_amount,
                    'payment_status' => $item->payment_status,
                    'user_name' => $item->user ? $item->user->name : 'N/A',
                    'raw_data' => $item
                ]);
            });
        }
        
        if ($this->report_type == 'all' || $this->report_type == 'return') {
            $this->getReturnInvoices()->get()->each(function ($item) use (&$data) {
                $data->push([
                    'id' => $item->id,
                    'type' => 'return',
                    'type_name' => 'Return Invoice',
                    'date' => $item->return_invoice_date,
                    'number' => $item->return_invoice_id,
                    'patient_name' => $item->patient ? $item->patient->name : 'N/A',
                    'doctor_name' => null,
                    'supplier_name' => null,
                    'service_name' => null,
                    'total_amount' => $item->net_amount,
                    'discount_amount' => 0,
                    'net_amount' => $item->net_amount,
                    'paid_amount' => $item->paid_amount,
                    'due_amount' => $item->due_amount,
                    'payment_status' => $item->payment_status,
                    'user_name' => $item->user ? $item->user->name : 'N/A',
                    'raw_data' => $item
                ]);
            });
        }
        
        if ($this->report_type == 'all' || $this->report_type == 'purchase') {
            $this->getPurchases()->get()->each(function ($item) use (&$data) {
                $data->push([
                    'id' => $item->id,
                    'type' => 'purchase',
                    'type_name' => 'Purchase',
                    'date' => $item->purchase_date,
                    'number' => $item->purchase_no,
                    'patient_name' => null,
                    'doctor_name' => null,
                    'supplier_name' => $item->supplier ? $item->supplier->name : 'N/A',
                    'service_name' => null,
                    'total_amount' => $item->net_amount,
                    'discount_amount' => 0,
                    'net_amount' => $item->net_amount,
                    'paid_amount' => $item->paid_amount,
                    'due_amount' => $item->due_amount,
                    'payment_status' => $item->paid_amount >= $item->net_amount ? 'Paid' : ($item->paid_amount > 0 ? 'Partial' : 'Due'),
                    'user_name' => $item->user ? $item->user->name : 'N/A',
                    'raw_data' => $item
                ]);
            });
        }
        
        // Apply sorting to the combined data
        $data = $data->sortBy([$this->sortField, fn ($a, $b) => $this->sortDirection === 'asc' 
            ? $a <=> $b 
            : $b <=> $a
        ]);
        
        return $data;
    }
    
    // Paginate the combined data
    protected function paginateCollection($items, $perPage)
    {
        $page = $this->page ?: 1;
        $offset = ($page * $perPage) - $perPage;
        
        return new LengthAwarePaginator(
            $items->slice($offset, $perPage)->values(),
            $items->count(),
            $perPage,
            $page,
            [
                'path' => request()->url(),
                'query' => request()->query(),
                'pageName' => 'page'
            ]
        );
    }

    // Get Fee Receipts
    public function getFeeReceipts()
    {
        $query = FeesReceipt::with('patient', 'employee', 'fees', 'user')
            ->where('is_delete', 0);
        
        $this->applyCommonFilters($query);
        
        // Doctor specific filter
        if (!empty($this->searchByDoctor)) {
            $query->whereHas('employee', function ($q) {
                $q->whereRaw("CONCAT(first_name, ' ', last_name) like ?", ['%' . $this->searchByDoctor . '%']);
            });
        }
        
        // Global search
        if (!empty($this->search)) {
            $query->where(function ($q) {
                $q->where('id', 'like', '%' . $this->search . '%')
                    ->orWhereHas('patient', function ($query) {
                        $query->where('name', 'like', '%' . $this->search . '%');
                    })
                    ->orWhereHas('employee', function ($query) {
                        $query->where('first_name', 'like', '%' . $this->search . '%')
                            ->orWhere('last_name', 'like', '%' . $this->search . '%');
                    });
            });
        }
        
        return $query->orderBy('created_at', 'desc');
    }
    
    // Get Service Receipts
    public function getServiceReceipts()
    {
        $query = ServiceReceipt::with('patient', 'employee', 'service', 'user')
            ->where('is_delete', 0);
        
        $this->applyCommonFilters($query);
        
        // Doctor specific filter
        if (!empty($this->searchByDoctor)) {
            $query->whereHas('employee', function ($q) {
                $q->whereRaw("CONCAT(first_name, ' ', last_name) like ?", ['%' . $this->searchByDoctor . '%']);
            });
        }
        
        // Global search
        if (!empty($this->search)) {
            $query->where(function ($q) {
                $q->where('id', 'like', '%' . $this->search . '%')
                    ->orWhereHas('patient', function ($query) {
                        $query->where('name', 'like', '%' . $this->search . '%');
                    })
                    ->orWhereHas('service', function ($query) {
                        $query->where('name', 'like', '%' . $this->search . '%');
                    });
            });
        }
        
        return $query->orderBy('created_at', 'desc');
    }
    
    // Get Sale Invoices
    public function getSaleInvoices()
    {
        $query = SaleInvoice::with('patient', 'user')
            ->where('is_delete', 0);
        
        $this->applyCommonFilters($query);
        
        // Payment specific filters
        if (!empty($this->search_payment_status)) {
            $query->where('payment_status', $this->search_payment_status);
        }
        
        if (!empty($this->search_payment_method)) {
            $query->where('payment_method', $this->search_payment_method);
        }
        
        // Global search
        if (!empty($this->search)) {
            $query->where(function ($q) {
                $q->where('invoice_no', 'like', '%' . $this->search . '%')
                    ->orWhereHas('patient', function ($query) {
                        $query->where('name', 'like', '%' . $this->search . '%');
                    });
            });
        }
        
        return $query->orderBy('invoice_date', 'desc');
    }
    
    // Get Return Invoices
    public function getReturnInvoices()
    {
        $query = ReturnInvoice::with('patient', 'user')
            ->where('is_delete', 0);
        
        $this->applyCommonFilters($query);
        
        // Payment specific filters
        if (!empty($this->search_payment_status)) {
            $query->where('payment_status', $this->search_payment_status);
        }
        
        if (!empty($this->search_payment_method)) {
            $query->where('payment_method', $this->search_payment_method);
        }
        
        // Global search
        if (!empty($this->search)) {
            $query->where(function ($q) {
                $q->where('return_invoice_id', 'like', '%' . $this->search . '%')
                    ->orWhereHas('patient', function ($query) {
                        $query->where('name', 'like', '%' . $this->search . '%');
                    });
            });
        }
        
        return $query->orderBy('return_invoice_date', 'desc');
    }
    
    // Get Purchases
    public function getPurchases()
    {
        $query = Purchase::with('supplier', 'user')
            ->where('is_delete', 0)
            ->where('is_active', 1);
        
        $this->applyCommonFilters($query);
        
        // Supplier specific filter
        if (!empty($this->searchBySupplier)) {
            $query->whereHas('supplier', function ($q) {
                $q->where('name', 'like', '%' . $this->searchBySupplier . '%');
            });
        }
        
        // Global search
        if (!empty($this->search)) {
            $query->where(function ($q) {
                $q->where('purchase_no', 'like', '%' . $this->search . '%')
                    ->orWhere('invoice_no', 'like', '%' . $this->search . '%')
                    ->orWhereHas('supplier', function ($query) {
                        $query->where('name', 'like', '%' . $this->search . '%');
                    });
            });
        }
        
        return $query->orderBy('purchase_date', 'desc');
    }
    
    // Apply common filters that work for all report types
    private function applyCommonFilters($query)
    {
        // ID filter
        if (!empty($this->searchById)) {
            $query->where('id', $this->searchById);
        }
        
        // ID range filter
        if (!empty($this->searchFromId) && !empty($this->searchToId)) {
            $query->whereBetween('id', [$this->searchFromId, $this->searchToId]);
        }
        
        // Patient filter (for models that have patient relationship)
        if (!empty($this->searchByPatient) && method_exists($query->getModel(), 'patient')) {
            $query->whereHas('patient', function ($q) {
                $q->where('name', 'like', '%' . $this->searchByPatient . '%');
            });
        }
        
        // Date range filter - handle different date column names
        if (!empty($this->searchFromDate) && !empty($this->searchToDate)) {
            $fromDate = Carbon::createFromFormat('Y-m-d', $this->searchFromDate)->startOfDay();
            $toDate = Carbon::createFromFormat('Y-m-d', $this->searchToDate)->endOfDay();
            
            $model = $query->getModel();
            $dateColumn = 'created_at'; // Default date column
            
            // Check if model has specific date columns
            if (in_array('invoice_date', $model->getFillable())) {
                $dateColumn = 'invoice_date';
            } elseif (in_array('return_invoice_date', $model->getFillable())) {
                $dateColumn = 'return_invoice_date';
            } elseif (in_array('purchase_date', $model->getFillable())) {
                $dateColumn = 'purchase_date';
            }
            
            $query->whereBetween($dateColumn, [$fromDate, $toDate]);
        }
    }

    // Calculate report totals
    public function getReportTotals()
    {
        $allData = $this->getUnifiedData();
        
        return [
            'totalAmount' => $allData->sum('total_amount'),
            'totalDiscount' => $allData->sum('discount_amount'),
            'totalNetAmount' => $allData->sum('net_amount'),
            'totalPaidAmount' => $allData->sum('paid_amount'),
            'totalDueAmount' => $allData->sum('due_amount')
        ];
    }

    // Export as PDF
    public function pdf()
    {
        // Store filters in session for reference
        session()->put('print_filters', [
            'report_type' => $this->report_type,
            'searchById' => $this->searchById,
            'searchByPatient' => $this->searchByPatient,
            'searchByDoctor' => $this->searchByDoctor,
            'searchBySupplier' => $this->searchBySupplier,
            'searchFromDate' => $this->searchFromDate,
            'searchToDate' => $this->searchToDate,
            'searchFromId' => $this->searchFromId,
            'searchToId' => $this->searchToId,
            'search_payment_status' => $this->search_payment_status,
            'search_payment_method' => $this->search_payment_method,
        ]);
        
        // Get all data (without pagination)
        $reportData = $this->getUnifiedData();
        $totals = $this->getReportTotals();
        
        $pdf = Pdf::loadView('livewire.reports.unified-report-pdf', [
            'reportData' => $reportData,
            'totals' => $totals,
            'report_type' => $this->report_type,
            'searchFromDate' => $this->searchFromDate,
            'searchToDate' => $this->searchToDate,
            'searchById' => $this->searchById,
            'searchFromId' => $this->searchFromId,
            'searchToId' => $this->searchToId,
            'searchByPatient' => $this->searchByPatient,
            'searchByDoctor' => $this->searchByDoctor,
            'searchBySupplier' => $this->searchBySupplier,
            'search_payment_status' => $this->search_payment_status,
            'search_payment_method' => $this->search_payment_method,
            'totalAmount' => $totals['totalAmount'],
            'totalDiscount' => $totals['totalDiscount'],
            'totalNetAmount' => $totals['totalNetAmount'],
            'totalPaidAmount' => $totals['totalPaidAmount'],
            'totalDueAmount' => $totals['totalDueAmount']
        ]);
        
        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->stream();
        }, 'unified-report.pdf');
    }
    
    // Export to Excel
    public function excel()
    {
        // Store filters in session for reference
        session()->put('print_filters', [
            'report_type' => $this->report_type,
            'searchById' => $this->searchById,
            'searchByPatient' => $this->searchByPatient,
            'searchByDoctor' => $this->searchByDoctor,
            'searchBySupplier' => $this->searchBySupplier,
            'searchFromDate' => $this->searchFromDate,
            'searchToDate' => $this->searchToDate,
            'searchFromId' => $this->searchFromId,
            'searchToId' => $this->searchToId,
            'search_payment_status' => $this->search_payment_status,
            'search_payment_method' => $this->search_payment_method,
        ]);
        
        // Get all data (without pagination)
        $reportData = $this->getUnifiedData();
        
        // Create filename with date
        $filename = 'unified_report_' . date('Y-m-d') . '.xlsx';
        
        return Excel::download(new class($reportData, $this->report_type) implements \Maatwebsite\Excel\Concerns\FromCollection, \Maatwebsite\Excel\Concerns\WithHeadings, \Maatwebsite\Excel\Concerns\WithMapping {
            protected $reportData;
            protected $report_type;
            
            public function __construct($reportData, $report_type)
            {
                $this->reportData = $reportData;
                $this->report_type = $report_type;
            }
            
            public function collection()
            {
                return $this->reportData;
            }
            
            public function headings(): array
            {
                return [
                    'S.No',
                    'Type',
                    'ID/Number',
                    'Date', 
                    'Patient/Supplier',
                    'Doctor',
                    'Service/Item',
                    'Total Amount',
                    'Discount',
                    'Net Amount',
                    'Paid Amount',
                    'Due Amount',
                    'Payment Status',
                    'Created By'
                ];
            }
            
            public function map($row): array
            {
                // Determine the name to display (patient or supplier)
                $name = !empty($row['patient_name']) ? $row['patient_name'] : $row['supplier_name'];
                
                return [
                    'S.No' => $this->reportData->search($row) + 1,
                    'Type' => $row['type_name'],
                    'ID/Number' => $row['number'],
                    'Date' => $row['date'] instanceof \Carbon\Carbon 
                        ? $row['date']->format('Y-m-d') 
                        : $row['date'],
                    'Patient/Supplier' => $name,
                    'Doctor' => $row['doctor_name'],
                    'Service/Item' => $row['service_name'],
                    'Total Amount' => number_format($row['total_amount'], 2),
                    'Discount' => number_format($row['discount_amount'], 2),
                    'Net Amount' => number_format($row['net_amount'], 2),
                    'Paid Amount' => number_format($row['paid_amount'], 2),
                    'Due Amount' => number_format($row['due_amount'], 2),
                    'Payment Status' => $row['payment_status'],
                    'Created By' => $row['user_name']
                ];
            }
        }, $filename);
    }
    
    // Print function
    public function print()
    {
        // Get filters from session
        $filters = session('print_filters', []);
        
        // Get all data (without pagination) based on current filters
        $reportData = $this->getUnifiedData();
        $totals = $this->getReportTotals();
        
        // Return view for printing
        return view('livewire.reports.unified-report-print', [
            'reportData' => $reportData,
            'report_type' => $this->report_type,
            'totalAmount' => $totals['totalAmount'],
            'totalDiscount' => $totals['totalDiscount'],
            'totalNetAmount' => $totals['totalNetAmount'],
            'totalPaidAmount' => $totals['totalPaidAmount'],
            'totalDueAmount' => $totals['totalDueAmount']
        ]);
    }
    
    // Render function
    public function render()
    {
        // Get unified data with pagination
        $unifiedData = $this->getUnifiedData();
        $paginatedData = $this->paginateCollection($unifiedData, $this->perPage);
        
        // Calculate totals
        $totals = $this->getReportTotals();
        
        return view('livewire.reports.unified-report', [
            'unifiedData' => $paginatedData,
            'totalAmount' => $totals['totalAmount'],
            'totalDiscount' => $totals['totalDiscount'],
            'totalNetAmount' => $totals['totalNetAmount'],
            'totalPaidAmount' => $totals['totalPaidAmount'],
            'totalDueAmount' => $totals['totalDueAmount'],
        ]);
    }
}
