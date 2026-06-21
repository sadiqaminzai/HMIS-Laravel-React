<?php

namespace App\Livewire\Reception;

use App\Models\Reception\Patient;
use Livewire\Component;
use Illuminate\Support\Facades\Auth;
use Livewire\WithFileUploads;
use Livewire\WithPagination;
use Barryvdh\DomPDF\PDF;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\PermissionsExport;
use App\Imports\PermissionsImport;
use App\Models\General\Employee;
use App\Models\General\Service;
use App\Models\Reception\ServiceReceipt;
use Carbon\Carbon;

class ServiceReceiptReport extends Component
{
    use WithFileUploads, WithPagination;

    public $name, $father_name, $mobile, $email, $age, $gender, $address, $city, $state, $zip_code, $emergency_contact_name, $emergency_contact_number, $created_by, $updated_by, $deleted_by, $is_active, $is_delete;

    // Search by: ID, Name, Created At
    public $searchById = '', $searchByPatient = '', $searchByDoctor = '', $searchByCreatedAt = '', $searchFromDate = '', $searchToDate = '';
    // ID range search
    public $searchFromId = '', $searchToId = '';
    public $searchResults = [];

    // Dynamic search fields
    public $search = '';
    public $isOpen = 0;
    public $selectedPatient;
    public $selected_data;

    public $totalAmount = 0;
    public $totalDiscount = 0;
    public $totalNetAmount = 0;

    protected $paginationTheme = 'bootstrap';

    public function searchDetails()
    {
        session()->put('print_filters', [
            'searchById'      => $this->searchById,
            'searchByPatient' => $this->searchByPatient,
            'searchByDoctor'  => $this->searchByDoctor ?: $this->search, // Use $this->search if searchByDoctor is empty
            'searchFromDate'  => $this->searchFromDate,
            'searchToDate'    => $this->searchToDate,
            'searchFromId'    => $this->searchFromId,
            'searchToId'      => $this->searchToId,
        ]);

        $query = ServiceReceipt::with('patient', 'employee', 'service', 'user')
            ->where('is_delete', 0);

        if (!empty($this->searchById)) {
            $query->where('id', $this->searchById);
        }

        // ID range search
        if (!empty($this->searchFromId) && !empty($this->searchToId)) {
            $query->whereBetween('id', [$this->searchFromId, $this->searchToId]);
        }

        if (!empty($this->searchByPatient)) {
            $query->whereHas('patient', function ($q) {
                $q->where('name', 'like', '%' . $this->searchByPatient . '%');
            });
        }

        if (!empty($this->searchByDoctor)) {
            $query->whereHas('employee', function ($q) {
                $q->whereRaw("CONCAT(first_name, ' ', last_name) like ?", ['%' . $this->searchByDoctor . '%']);
            });
        }

        if (!empty($this->searchFromDate) && !empty($this->searchToDate)) {
            $query->whereBetween('created_at', [
                \Carbon\Carbon::createFromFormat('Y-m-d', $this->searchFromDate)->startOfDay(),
                \Carbon\Carbon::createFromFormat('Y-m-d', $this->searchToDate)->endOfDay()
            ]);
        }

        $this->searchResults = $query->orderBy('created_at', 'asc')->get();

        // Calculate the totals using Collection's sum() method
        $this->totalAmount = collect($this->searchResults)->sum('total_amount');
        $this->totalDiscount = collect($this->searchResults)->sum('discount_amount');
        $this->totalNetAmount = $this->totalAmount - $this->totalDiscount;

        // Dispatch a browser event to open the modal
        $this->dispatch('open-search-modal');
    }

    public function closeSearchModal()
    {
        $this->selectedPatient = null;
        $this->dispatch('close-modal', 'detailsModal');
    }

    public function resetFilters()
    {
        $this->searchById         = '';
        $this->searchByPatient    = '';
        $this->searchByDoctor     = '';
        $this->searchByCreatedAt  = '';
        $this->searchFromDate     = '';
        $this->searchToDate       = '';
        $this->searchFromId       = '';
        $this->searchToId         = '';
        $this->selectedPatient    = null;
        $this->searchResults      = [];
    }

    public function showDetails($id)
    {
        $this->selected_data = ServiceReceipt::with('patient', 'employee', 'service', 'user')->findOrFail($id);
        $this->dispatch('open-modal', 'detailsModal');
    }

    public function closeDetailsModal()
    {
        $this->selectedPatient = null;
        $this->dispatch('close-modal', 'detailsModal');
    }

    public function updatingSearch()
    {
        $this->resetPage(); // Reset pagination when search query is updated
    }


    public function render()
    {
        $patients = Patient::where('is_active', 1)
            ->where('is_delete', 0)
            ->orderBy('id', 'desc')
            ->get();
        $employees = Employee::where('is_delete', 0)
            ->where('is_active', 1)
            ->whereHas('designation', function ($query) {
                $query->where('name', 'like', '%doctor%');
            })
            ->get();
        $services = Service::where('is_active', 1)->where('is_delete', 0)->get();

        $service_receipts_query = ServiceReceipt::with('patient', 'employee', 'service', 'user')
            ->where('is_delete', 0) // Only display records where is_delete is 0
            ->where(function ($query) {
                $query->whereHas('patient', function ($query) {
                    $query->where('name', 'like', '%' . $this->search . '%'); // Search filter for patient name
                })
                    ->orWhereHas('employee', function ($query) {
                        $query->where(function ($query) {
                            $query->where('first_name', 'like', '%' . $this->search . '%')
                                ->orWhere('last_name', 'like', '%' . $this->search . '%'); // Search filter for doctor's first or last name
                        });
                    })
                    ->orWhere('id', 'like', '%' . $this->search . '%') // Search filter for service receipt ID
                    ->orWhereHas('user', function ($query) {
                        $query->where('name', 'like', '%' . $this->search . '%'); // Search filter for creator's name
                    });
            });

        if ($this->search) {
            $service_receipts = $service_receipts_query->orderBy('id', 'desc')->get();
        } else {
            $service_receipts = $service_receipts_query->orderBy('id', 'desc')->paginate(15); // Paginate results (adjust as needed)
        }

        return view('livewire.reception.service-receipt-report', ['service_receipts' => $service_receipts, 'patients' => $patients, 'employees' => $employees, 'services' => $services]);
    }

    // export as PDF
    public function pdf()
    {
        $query = ServiceReceipt::with('patient', 'employee', 'service', 'user')
            ->where('is_delete', 0);

        if (!empty($this->searchById)) {
            $query->where('id', $this->searchById);
        }

        // ID range search for PDF
        if (!empty($this->searchFromId) && !empty($this->searchToId)) {
            $query->whereBetween('id', [$this->searchFromId, $this->searchToId]);
        }

        if (!empty($this->searchByPatient)) {
            $query->whereHas('patient', function ($q) {
                $q->where('name', 'like', '%' . $this->searchByPatient . '%');
            });
        }

        if (!empty($this->searchByDoctor)) {
            $query->whereHas('employee', function ($q) {
                $q->whereRaw("CONCAT(first_name, ' ', last_name) like ?", ['%' . $this->searchByDoctor . '%']);
            });
        }

        if (!empty($this->searchFromDate) && !empty($this->searchToDate)) {
            $query->whereBetween('created_at', [
                \Carbon\Carbon::createFromFormat('Y-m-d', $this->searchFromDate)->startOfDay(),
                \Carbon\Carbon::createFromFormat('Y-m-d', $this->searchToDate)->endOfDay()
            ]);
        }

        $serviceReceipts = $query->orderBy('created_at', 'asc')->get();
        $totalAmount = collect($serviceReceipts)->sum('total_amount');
        $totalDiscount = collect($serviceReceipts)->sum('discount_amount');
        $totalNetAmount = $totalAmount - $totalDiscount;

        // Generate the PDF
        $pdf = app(PDF::class)->loadView('livewire.reception.service_receipt_reports.pdf', [
            'serviceReceipts' => $serviceReceipts,
            'totalAmount'     => $totalAmount,
            'totalDiscount'   => $totalDiscount,
            'totalNetAmount'  => $totalNetAmount
        ]);

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->stream();
        }, 'service-receipt-report.pdf');
    }

    // print logic:
    public function print()
    {
        $filters = session('print_filters', []);

        $query = ServiceReceipt::with('patient', 'employee', 'service', 'user')
            ->where('is_delete', 0);

        if (!empty($filters['searchById'])) {
            $query->where('id', $filters['searchById']);
        }
        
        // ID range search for print
        if (!empty($filters['searchFromId']) && !empty($filters['searchToId'])) {
            $query->whereBetween('id', [$filters['searchFromId'], $filters['searchToId']]);
        }
        
        if (!empty($filters['searchByPatient'])) {
            $query->whereHas('patient', function ($q) use ($filters) {
                $q->where('name', 'like', '%' . $filters['searchByPatient'] . '%');
            });
        }
        if (!empty($filters['searchByDoctor'])) {
            $query->whereHas('employee', function ($q) use ($filters) {
                $q->whereRaw("CONCAT(first_name, ' ', last_name) like ?", ['%' . $filters['searchByDoctor'] . '%']);
            });
        }
        if (!empty($filters['searchFromDate']) && !empty($filters['searchToDate'])) {
            $query->whereBetween('created_at', [
                Carbon::createFromFormat('Y-m-d', $filters['searchFromDate'])->startOfDay(),
                Carbon::createFromFormat('Y-m-d', $filters['searchToDate'])->endOfDay(),
            ]);
        }

        $service_receipts  = $query->orderBy('created_at', 'asc')->get();
        $totalAmount     = $service_receipts->sum('total_amount');
        $totalDiscount = $service_receipts->sum('discount_amount');
        $totalNetAmount = $totalAmount - $totalDiscount;

        return view('livewire.reception.service_receipt_reports.print', compact('service_receipts', 'totalAmount', 'totalDiscount', 'totalNetAmount'));
    }

    // export to Excel
    public function excel()
    {
        $query = ServiceReceipt::with(['patient', 'employee', 'service', 'user'])
            ->where('is_delete', 0);

        // Apply filters
        if (!empty($this->searchById)) {
            $query->where('id', $this->searchById);
        }

        // ID range search for Excel
        if (!empty($this->searchFromId) && !empty($this->searchToId)) {
            $query->whereBetween('id', [$this->searchFromId, $this->searchToId]);
        }

        if (!empty($this->searchByPatient)) {
            $query->whereHas('patient', function ($q) {
                $q->where('name', 'like', '%' . $this->searchByPatient . '%');
            });
        }

        if (!empty($this->searchByDoctor)) {
            $query->whereHas('employee', function ($q) {
                $q->whereRaw("CONCAT(first_name, ' ', last_name) like ?", ['%' . $this->searchByDoctor . '%']);
            });
        }

        if (!empty($this->searchFromDate) && !empty($this->searchToDate)) {
            $query->whereBetween('created_at', [
                \Carbon\Carbon::createFromFormat('Y-m-d', $this->searchFromDate)->startOfDay(),
                \Carbon\Carbon::createFromFormat('Y-m-d', $this->searchToDate)->endOfDay()
            ]);
        }

        $serviceReceipts = $query->orderBy('created_at', 'asc')->get();
        
        // Calculate totals
        $totalAmount = $serviceReceipts->sum('total_amount');
        $totalDiscount = $serviceReceipts->sum('discount_amount');
        $totalNetAmount = $totalAmount - $totalDiscount;
        
        // Create filename with date
        $filename = 'service_receipt_report_' . date('Y-m-d') . '.xlsx';

        return Excel::download(new class($serviceReceipts, $totalAmount, $totalDiscount, $totalNetAmount) implements \Maatwebsite\Excel\Concerns\FromCollection, \Maatwebsite\Excel\Concerns\WithHeadings {
            protected $serviceReceipts;
            protected $totalAmount;
            protected $totalDiscount;
            protected $totalNetAmount;

            public function __construct($serviceReceipts, $totalAmount, $totalDiscount, $totalNetAmount)
            {
                $this->serviceReceipts = $serviceReceipts;
                $this->totalAmount = $totalAmount;
                $this->totalDiscount = $totalDiscount;
                $this->totalNetAmount = $totalNetAmount;
            }

            public function collection()
            {
                $data = collect();
                
                foreach ($this->serviceReceipts as $index => $receipt) {
                    $netAmount = $receipt->total_amount - $receipt->discount_amount;
                    
                    $data->push([
                        'S.No' => $index + 1,
                        'Receipt ID' => $receipt->id,
                        'Patient' => $receipt->patient ? $receipt->patient->name : 'N/A',
                        'Doctor' => $receipt->employee ? $receipt->employee->first_name . ' ' . $receipt->employee->last_name : 'N/A',
                        'Total Amount' => $receipt->total_amount,
                        'Discount' => $receipt->discount_amount,
                        'Net Amount' => $netAmount,
                        'Created Date' => $receipt->created_at ? $receipt->created_at->format('Y-m-d') : 'N/A',
                        'Created By' => $receipt->user ? $receipt->user->name : 'N/A'
                    ]);
                }
                
                // Add a total row at the bottom
                $data->push([
                    'S.No' => '',
                    'Receipt ID' => '',
                    'Patient' => '',
                    'Doctor' => 'TOTALS',
                    'Total Amount' => $this->totalAmount,
                    'Discount' => $this->totalDiscount,
                    'Net Amount' => $this->totalNetAmount,
                    'Created Date' => '',
                    'Created By' => ''
                ]);
                
                return $data;
            }

            public function headings(): array
            {
                return [
                    'S.No',
                    'Receipt ID',
                    'Patient',
                    'Doctor',
                    'Total Amount',
                    'Discount',
                    'Net Amount',
                    'Created Date',
                    'Created By'
                ];
            }
        }, $filename);
    }
}

