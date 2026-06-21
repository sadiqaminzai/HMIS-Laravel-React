<?php

namespace App\Livewire\Reception;
use App\Models\Pharmacy\ReturnInvoice;
use Livewire\WithPagination;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Auth;
use Barryvdh\DomPDF\PDF;
use Carbon\Carbon;

use Livewire\Component;

class ReturnInvoiceReceiptReport extends Component
{
    use WithPagination;

    public $id, $return_invoice_id, $return_invoice_date, $patient_name, $payment_status, $payment_method,
        $total_amount, $total_discount, $total_quantity, $net_amount, $paid_amount, $due_amount,
        $discount_id, $discount_reason, $created_by, $updated_by, $is_active, $is_delete;

    public $search_return_invoice_id, $search_return_invoice_date, $search_patient_name, $search_payment_status, $search_payment_method; 
    public $searchFromDate, $searchToDate, $searchFromId, $searchToId;
    public $isOpen = 0;
    public $selectedInvoice;
    public $searchResults = [];
    public $totalNetAmount = 0;
    public $totalPaidAmount = 0;
    public $totalDueAmount = 0;

    protected $paginationTheme = 'bootstrap'; // To use Bootstrap for pagination
    public function showDetails($id)
    {
        $this->selectedInvoice = ReturnInvoice::with(['patient', 'user'])->findOrFail($id);
        $this->dispatch('open-modal', 'detailsModal');
    }
    public function closeDetailsModal()
    {
        $this->selectedInvoice = null;
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
        $this->return_invoice_id = '';
        $this->return_invoice_date = '';
        $this->patient_name = '';
        $this->payment_status = '';
        $this->payment_method = '';
        $this->total_amount = '';
        $this->total_discount = '';
        $this->total_quantity = '';
        $this->net_amount = '';
        $this->paid_amount = '';
        $this->due_amount = '';
        $this->discount_id = '';
        $this->discount_reason = '';
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
        $this->search_return_invoice_id = '';
        $this->search_return_invoice_date = '';
        $this->search_patient_name = '';
        $this->search_payment_status = '';
        $this->search_payment_method = '';
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
            'search_return_invoice_id' => $this->search_return_invoice_id,
            'search_return_invoice_date' => $this->search_return_invoice_date,
            'search_patient_name' => $this->search_patient_name,
            'search_payment_status' => $this->search_payment_status,
            'search_payment_method' => $this->search_payment_method,
            'searchFromDate' => $this->searchFromDate,
            'searchToDate' => $this->searchToDate,
            'searchFromId' => $this->searchFromId,
            'searchToId' => $this->searchToId,
        ]);

        $query = ReturnInvoice::with('patient')
            ->where(function ($q) {
                if ($this->search_return_invoice_id) {
                    $q->where('return_invoice_id', 'like', '%' . $this->search_return_invoice_id . '%');
                }
                if ($this->search_return_invoice_date) {
                    $q->where('return_invoice_date', 'like', '%' . $this->search_return_invoice_date . '%');
                }
                if ($this->search_patient_name) {
                    $q->whereHas('patient', function ($q) {
                        $q->where('name', 'like', '%' . $this->search_patient_name . '%');
                    });
                }
                if ($this->search_payment_status) {
                    $q->where('payment_status', 'like', '%' . $this->search_payment_status . '%');
                }
                if ($this->search_payment_method) {
                    $q->where('payment_method', 'like', '%' . $this->search_payment_method . '%');
                }
                if ($this->searchFromDate && $this->searchToDate) {
                    $q->whereBetween('return_invoice_date', [$this->searchFromDate, $this->searchToDate]);
                }
                if ($this->searchFromId && $this->searchToId) {
                    $q->whereBetween('id', [$this->searchFromId, $this->searchToId]);
                }
            })
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
        $query = ReturnInvoice::query();

        if ($this->search_return_invoice_id) {
            $query->where('return_invoice_id', 'like', '%' . $this->search_return_invoice_id . '%');
        }

        if ($this->search_return_invoice_date) {
            $query->where('return_invoice_date', 'like', '%' . $this->search_return_invoice_date . '%');
        }

        if ($this->search_patient_name) {
            $query->whereHas('patient', function ($q) {
                $q->where('name', 'like', '%' . $this->search_patient_name . '%');
            });
        }

        if ($this->search_payment_status) {
            $query->where('payment_status', 'like', '%' . $this->search_payment_status . '%');
        }

        if ($this->search_payment_method) {
            $query->where('payment_method', 'like', '%' . $this->search_payment_method . '%');
        }

        if ($this->searchFromDate && $this->searchToDate) {
            $query->whereBetween('return_invoice_date', [$this->searchFromDate, $this->searchToDate]);
        }
        
        if ($this->searchFromId && $this->searchToId) {
            $query->whereBetween('id', [$this->searchFromId, $this->searchToId]);
        }

        $invoices = $query->with('patient')
            ->orderBy('id', 'DESC')
            ->paginate(10);

        return view('livewire.reception.return-invoice-receipt-report', [
            'invoices' => $invoices,
        ]);
    }

    public function excel()
    {
        // Apply the same filters as in the render method
        $query = ReturnInvoice::query();

        if ($this->search_return_invoice_id) {
            $query->where('return_invoice_id', 'like', '%' . $this->search_return_invoice_id . '%');
        }

        if ($this->search_return_invoice_date) {
            $query->where('return_invoice_date', 'like', '%' . $this->search_return_invoice_date . '%');
        }

        if ($this->search_patient_name) {
            $query->whereHas('patient', function ($q) {
                $q->where('name', 'like', '%' . $this->search_patient_name . '%');
            });
        }

        if ($this->search_payment_status) {
            $query->where('payment_status', 'like', '%' . $this->search_payment_status . '%');
        }

        if ($this->search_payment_method) {
            $query->where('payment_method', 'like', '%' . $this->search_payment_method . '%');
        }

        if ($this->searchFromDate && $this->searchToDate) {
            $query->whereBetween('return_invoice_date', [$this->searchFromDate, $this->searchToDate]);
        }
        
        if ($this->searchFromId && $this->searchToId) {
            $query->whereBetween('id', [$this->searchFromId, $this->searchToId]);
        }

        $invoices = $query->with('patient')
            ->orderBy('id', 'DESC')
            ->get();
        
        // Calculate totals
        $totalNetAmount = $invoices->sum('net_amount');
        $totalPaidAmount = $invoices->sum('paid_amount');
        $totalDueAmount = $invoices->sum('due_amount');
        
        // Add filename with date
        $filename = 'return_invoice_report_' . date('Y-m-d') . '.xlsx';
        
        // If no records found, show a message
        if ($invoices->isEmpty()) {
            session()->flash('message', 'No records found matching your search criteria.');
            return redirect()->back();
        }
        
        return Excel::download(new class($invoices, $totalNetAmount, $totalPaidAmount, $totalDueAmount) implements \Maatwebsite\Excel\Concerns\FromCollection, \Maatwebsite\Excel\Concerns\WithHeadings {
            protected $invoices;
            protected $totalNetAmount;
            protected $totalPaidAmount;
            protected $totalDueAmount;

            public function __construct($invoices, $totalNetAmount, $totalPaidAmount, $totalDueAmount)
            {
                $this->invoices = $invoices;
                $this->totalNetAmount = $totalNetAmount;
                $this->totalPaidAmount = $totalPaidAmount;
                $this->totalDueAmount = $totalDueAmount;
            }

            public function collection()
            {
                $data = $this->invoices->map(function ($invoice, $key) {
                    return [
                        'S.No' => $key + 1,
                        'Return Invoice ID' => $invoice->return_invoice_id,
                        'Patient Name' => $invoice->patient->name,
                        'Return Invoice Date' => $invoice->return_invoice_date,
                        'Payment Status' => $invoice->payment_status,
                        'Payment Method' => $invoice->payment_method,
                        'Net Amount' => $invoice->net_amount,
                        'Paid Amount' => $invoice->paid_amount,
                        'Due Amount' => $invoice->due_amount,
                    ];
                });
                
                // Add empty row and totals row
                $data->push([
                    'S.No' => '',
                    'Return Invoice ID' => '',
                    'Patient Name' => '',
                    'Return Invoice Date' => '',
                    'Payment Status' => '',
                    'Payment Method' => '',
                    'Net Amount' => '',
                    'Paid Amount' => '',
                    'Due Amount' => '',
                ]);
                
                $data->push([
                    'S.No' => '',
                    'Return Invoice ID' => '',
                    'Patient Name' => '',
                    'Return Invoice Date' => '',
                    'Payment Status' => '',
                    'Payment Method' => 'Total:',
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
                    'Return Invoice ID',
                    'Patient Name',
                    'Return Invoice Date',
                    'Payment Status',
                    'Payment Method',
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
        $query = ReturnInvoice::with('patient', 'user')
            ->where(function ($q) {
                if ($this->search_return_invoice_id) {
                    $q->where('return_invoice_id', 'like', '%' . $this->search_return_invoice_id . '%');
                }
                if ($this->search_return_invoice_date) {
                    $q->where('return_invoice_date', 'like', '%' . $this->search_return_invoice_date . '%');
                }
                if ($this->search_patient_name) {
                    $q->whereHas('patient', function ($q) {
                        $q->where('name', 'like', '%' . $this->search_patient_name . '%');
                    });
                }
                if ($this->search_payment_status) {
                    $q->where('payment_status', 'like', '%' . $this->search_payment_status . '%');
                }
                if ($this->search_payment_method) {
                    $q->where('payment_method', 'like', '%' . $this->search_payment_method . '%');
                }
                if ($this->searchFromDate && $this->searchToDate) {
                    $q->whereBetween('return_invoice_date', [$this->searchFromDate, $this->searchToDate]);
                }
                if ($this->searchFromId && $this->searchToId) {
                    $q->whereBetween('id', [$this->searchFromId, $this->searchToId]);
                }
            })
            ->orderBy('id', 'DESC')
            ->get();

        // Calculate totals
        $totalNetAmount = $query->sum('net_amount');
        $totalPaidAmount = $query->sum('paid_amount');
        $totalDueAmount = $query->sum('due_amount');

        // Generate PDF
        $pdf = app(PDF::class)->loadView('livewire.reception.return_invoice_reports.pdf', [
            'invoices' => $query,
            'totalNetAmount' => $totalNetAmount,
            'totalPaidAmount' => $totalPaidAmount,
            'totalDueAmount' => $totalDueAmount
        ]);

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->stream();
        }, 'return-invoice-report.pdf');
    }

    // Print logic
    public function print()
    {
        // Get filters from session
        $filters = session('print_filters', []);

        // Build query based on filters
        $query = ReturnInvoice::with('patient', 'user')
            ->where(function ($q) use ($filters) {
                if (!empty($filters['search_return_invoice_id'])) {
                    $q->where('return_invoice_id', 'like', '%' . $filters['search_return_invoice_id'] . '%');
                }
                if (!empty($filters['search_return_invoice_date'])) {
                    $q->where('return_invoice_date', 'like', '%' . $filters['search_return_invoice_date'] . '%');
                }
                if (!empty($filters['search_patient_name'])) {
                    $q->whereHas('patient', function ($subQ) use ($filters) {
                        $subQ->where('name', 'like', '%' . $filters['search_patient_name'] . '%');
                    });
                }
                if (!empty($filters['search_payment_status'])) {
                    $q->where('payment_status', 'like', '%' . $filters['search_payment_status'] . '%');
                }
                if (!empty($filters['search_payment_method'])) {
                    $q->where('payment_method', 'like', '%' . $filters['search_payment_method'] . '%');
                }
                if (!empty($filters['searchFromDate']) && !empty($filters['searchToDate'])) {
                    $q->whereBetween('return_invoice_date', [
                        Carbon::createFromFormat('Y-m-d', $filters['searchFromDate'])->startOfDay(),
                        Carbon::createFromFormat('Y-m-d', $filters['searchToDate'])->endOfDay(),
                    ]);
                }
                if (!empty($filters['searchFromId']) && !empty($filters['searchToId'])) {
                    $q->whereBetween('id', [$filters['searchFromId'], $filters['searchToId']]);
                }
            })
            ->orderBy('id', 'DESC')
            ->get();
        
        // Calculate totals
        $totalNetAmount = $query->sum('net_amount');
        $totalPaidAmount = $query->sum('paid_amount');
        $totalDueAmount = $query->sum('due_amount');

        // Return view for printing
        
        return view('livewire.reception.return_invoice_reports.print', compact('query', 'totalNetAmount', 'totalPaidAmount', 'totalDueAmount'));
    }
}


