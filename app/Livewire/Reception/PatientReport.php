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


class PatientReport extends Component
{
    use WithFileUploads, WithPagination;

    public $name, $father_name, $mobile, $email, $age, $gender, $address, $city, $state, $zip_code, $emergency_contact_name, $emergency_contact_number, $created_by, $updated_by, $deleted_by, $is_active, $is_delete;

    // Search by: ID, Name, Created At
    public $searchById = '', $searchByName = '', $searchByCreatedAt = '';
    public $searchResults = [];

    // Dynamic search fields
    public $search = '';
    public $isOpen = 0;
    public $selectedPatient;

    protected $paginationTheme = 'bootstrap';

    public $searchFromDate, $searchToDate;

    public function searchDetails()
    {
        session()->put('print_filters', [
            'searchById'      => $this->searchById,
            'searchByName'    => $this->searchByName,
            'searchByCreatedAt' => $this->searchByCreatedAt,
            'searchFromDate'  => $this->searchFromDate,
            'searchToDate'    => $this->searchToDate,
        ]);

        $query = Patient::with('user')->where('is_active', 1)->where('is_delete', 0);

        if (!empty($this->searchById)) {
            $query->where('id', $this->searchById);
        } elseif (!empty($this->searchByName)) {
            $query->where('name', $this->searchByName);
        } elseif (!empty($this->searchByCreatedAt)) {
            $query->whereDate('created_at', $this->searchByCreatedAt);
        }

        if (!empty($this->searchFromDate) && !empty($this->searchToDate)) {
            $query->whereBetween('created_at', [$this->searchFromDate, date('Y-m-d', strtotime($this->searchToDate . ' +1 day'))]);
        }

        $this->searchResults = $query->get();
        $this->dispatch('open-modal', 'detailsModal');
    }

    public function closeSearchModal()
    {
        $this->selectedPatient = null;
        $this->dispatch('close-modal', 'detailsModal');
    }

    public function resetFilters()
    {
        $this->searchById         = '';
        $this->searchByName       = '';
        $this->searchByCreatedAt  = '';
        $this->selectedPatient    = null;
        $this->searchResults      = [];
    }

    public function showDetails($id)
    {
        $this->selectedPatient = Patient::with('user')->findOrFail($id);
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
        $query = Patient::where('is_delete', 0)->where('is_active', 1);

        // Add a search filter
        $query->where(function ($query) {
            $query->where('name', 'like', '%' . $this->search . '%')
                ->orWhere('father_name', 'like', '%' . $this->search . '%')
                ->orWhere('mobile', 'like', '%' . $this->search . '%')
                ->orWhere('id', 'like', '%' . $this->search . '%')
                ->orWhereRaw("DATE_FORMAT(created_at, '%d-%m-%Y') like ?", ['%' . $this->search . '%']);
        });

        // Order by id desc
        $query->orderBy('id', 'desc');

        // Check if search is empty, then paginate, otherwise get all results
        if (empty($this->search)) {
            $patients = $query->paginate(25); // Paginate results (adjust as needed)
        } else {
            $patients = $query->get(); // Get all results without pagination
        }

        return view('livewire.reception.patient-report', ['patients' => $patients]);
    }

    // export as PDF
    public function pdf()
    {
        $query = Patient::with('user')->where('is_active', 1)->where('is_delete', 0);

        if (!empty($this->searchById)) {
            $query->where('id', $this->searchById);
        } elseif (!empty($this->searchByName)) {
            $query->where('name', $this->searchByName);
        } elseif (!empty($this->searchByCreatedAt)) {
            $query->whereDate('created_at', $this->searchByCreatedAt);
        }

        if (!empty($this->searchFromDate) && !empty($this->searchToDate)) {
            $query->whereBetween('created_at', [$this->searchFromDate, date('Y-m-d', strtotime($this->searchToDate . ' +1 day'))]);
        }

        $patients = $query->orderBy('created_at', 'asc')->get();

        $pdf = app(PDF::class)->loadView('livewire.reception.patient_reports.pdf', ['patients' => $patients]);

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->stream();
        }, 'patient-report.pdf');
    }

    // print logic:
    public function print()
    {
        // Store search filters in session for printing
        session()->put('print_filters', [
            'searchById'      => $this->searchById,
            'searchByName'    => $this->searchByName,
            'searchByCreatedAt' => $this->searchByCreatedAt,
            'searchFromDate'  => $this->searchFromDate,
            'searchToDate'    => $this->searchToDate,
        ]);
        
        // Dispatch event to open print window
        $this->dispatch('print-patient-report');
        
        // The view will be loaded in the new window through the route
        return;
    }

    // export to Excel
    public function excel()
    {
        $query = Patient::with('user')->where('is_active', 1)->where('is_delete', 0);

        if (!empty($this->searchById)) {
            $query->where('id', $this->searchById);
        } elseif (!empty($this->searchByName)) {
            $query->where('name', $this->searchByName);
        } elseif (!empty($this->searchByCreatedAt)) {
            $query->whereDate('created_at', $this->searchByCreatedAt);
        }

        if (!empty($this->searchFromDate) && !empty($this->searchToDate)) {
            $query->whereBetween('created_at', [$this->searchFromDate, date('Y-m-d', strtotime($this->searchToDate . ' +1 day'))]);
        }

        $patients = $query->orderBy('created_at', 'asc')->get();

        return Excel::download(new class($patients) implements \Maatwebsite\Excel\Concerns\FromCollection, \Maatwebsite\Excel\Concerns\WithHeadings {
            protected $patients;

            public function __construct($patients)
            {
                $this->patients = $patients;
            }

            public function collection()
            {
                return $this->patients;
            }

            public function headings(): array
            {
                return [
                    'ID',
                    'Name',
                    'Father Name',
                    'Mobile',
                    'Email',
                    'Age',
                    'Gender',
                    'Address',
                    'City',
                    'State',
                    'Zip Code',
                    'Emergency Contact Name',
                    'Emergency Contact Number',
                    'Created By',
                    'Updated By',
                    'Deleted By',
                    'Is Active',
                    'Is Delete',
                    'Created At',
                    'Updated At',
                ];
            }
        }, 'patient-report.xlsx');
    }
}
