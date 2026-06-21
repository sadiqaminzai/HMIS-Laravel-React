<?php

namespace App\Livewire\Laboratory;

use App\Models\General\Service;
use App\Models\General\ServiceType;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;
use Livewire\WithPagination;
use Maatwebsite\Excel\Facades\Excel;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;

class TestTypeReport extends Component
{
    use WithPagination;

    public $id, $name, $service_id, $created_by, $updated_by, $deleted_by, $is_active, $is_delete;

    public $search_name, $search_id, $searchFromDate, $searchToDate, $search_service_type_id;
    public $isOpen = 0;
    public $selectedService;
    public $searchResults = [];
    public $totalResults = 0;
    
    protected $paginationTheme = 'bootstrap';

    public function showDetails($id)
    {
        $this->selectedService = Service::findOrFail($id);
        $this->dispatch('open-modal', 'detailsModal');
    }

    public function closeDetailsModal()
    {
        $this->selectedService = null;
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
        $this->name = '';
        $this->service_id = '';
        $this->created_by = '';
        $this->updated_by = '';
        $this->deleted_by = '';
        $this->is_active = '';
        $this->is_delete = '';
    }

    public function search()
    {
        $this->resetPage();
    }

    public function clearSearch()
    {
        $this->search_name = '';
        $this->search_id = '';
        $this->searchFromDate = '';
        $this->searchToDate = '';
        $this->search_service_type_id = '';
        $this->resetPage();
    }

    public function searchDetails()
    {
        // Store search filters in session for printing
        session()->put('print_filters', [
            'search_name' => $this->search_name,
            'search_id' => $this->search_id,
            'searchFromDate' => $this->searchFromDate,
            'searchToDate' => $this->searchToDate,
            'search_service_type_id' => $this->search_service_type_id,
        ]);

        $query = Service::with('service_type')
            ->where('is_active', 1)
            ->where('is_delete', 0)
            ->where('is_lab_test', 1)
            ->where(function ($q) {
                if ($this->search_name) {
                    $q->where('name', 'like', '%' . $this->search_name . '%');
                }
                if ($this->search_id) {
                    $q->where('id', 'like', '%' . $this->search_id . '%');
                }
                if ($this->searchFromDate && $this->searchToDate) {
                    $q->whereBetween('created_at', [$this->searchFromDate, $this->searchToDate]);
                }
                if ($this->search_service_type_id) {
                    $q->where('service_type_id', $this->search_service_type_id);
                }
            })
            ->orderBy('id', 'DESC')
            ->get();

        $this->searchResults = $query;
        $this->totalResults = $query->count();
        $this->dispatch('open-search-modal');
    }

    public function closeSearchModal()
    {
        $this->dispatch('close-modal', 'searchModal');
    }

    public function render()
    {
        $query = Service::with('service_type');
        
        // Only include lab test services
        $query->where('is_active', 1)
            ->where('is_delete', 0)
            ->where('is_lab_test', 1);

        if ($this->search_name) {
            $query->where('name', 'like', '%' . $this->search_name . '%');
        }

        if ($this->search_id) {
            $query->where('id', 'like', '%' . $this->search_id . '%');
        }

        if ($this->searchFromDate && $this->searchToDate) {
            $query->whereBetween('created_at', [$this->searchFromDate, $this->searchToDate]);
        }
        
        if ($this->search_service_type_id) {
            $query->where('service_type_id', $this->search_service_type_id);
        }

        $services = $query->orderBy('id', 'DESC')
            ->paginate(10);
            
        // Get service types for dropdown
        $serviceTypes = ServiceType::where('is_active', 1)
            ->where('is_delete', 0)
            ->get();

        return view('livewire.laboratory.test-type-report', [
            'services' => $services,
            'serviceTypes' => $serviceTypes
        ]);
    }

    public function excel()
    {
        // Apply the same filters as in the render method
        $query = Service::with('service_type');
        
        // Only include lab test services
        $query->where('is_active', 1)
            ->where('is_delete', 0)
            ->where('is_lab_test', 1);

        if ($this->search_name) {
            $query->where('name', 'like', '%' . $this->search_name . '%');
        }

        if ($this->search_id) {
            $query->where('id', 'like', '%' . $this->search_id . '%');
        }

        if ($this->searchFromDate && $this->searchToDate) {
            $query->whereBetween('created_at', [$this->searchFromDate, $this->searchToDate]);
        }
        
        if ($this->search_service_type_id) {
            $query->where('service_type_id', $this->search_service_type_id);
        }

        $services = $query->orderBy('id', 'DESC')
            ->get();
        
        // Add filename with date
        $filename = 'test_type_report_' . date('Y-m-d') . '.xlsx';
        
        // If no records found, show a message
        if ($services->isEmpty()) {
            session()->flash('message', 'No records found matching your search criteria.');
            return redirect()->back();
        }
        
        return Excel::download(new class($services) implements \Maatwebsite\Excel\Concerns\FromCollection, \Maatwebsite\Excel\Concerns\WithHeadings {
            protected $services;

            public function __construct($services)
            {
                $this->services = $services;
            }

            public function collection()
            {
                $data = $this->services->map(function ($service, $key) {
                    return [
                        'S.No' => $key + 1,
                        'ID' => $service->id,
                        'Test Name' => $service->name,
                        'Service Type' => $service->service_type ? $service->service_type->name : 'N/A',
                        'Created At' => $service->created_at ? $service->created_at->format('Y-m-d') : '',
                        'Updated At' => $service->updated_at ? $service->updated_at->format('Y-m-d') : '',
                        'Status' => $service->is_active ? 'Active' : 'Inactive',
                    ];
                });
                
                return $data;
            }

            public function headings(): array
            {
                return [
                    'S.No',
                    'ID',
                    'Test Name',
                    'Service Type',
                    'Created At',
                    'Updated At',
                    'Status'
                ];
            }
        }, $filename);
    }

    // Export as PDF functionality
    public function pdf()
    {
        // Create query based on search filters
        $query = Service::with('service_type')
            ->where('is_active', 1)
            ->where('is_delete', 0)
            ->where('is_lab_test', 1)
            ->where(function ($q) {
                if ($this->search_name) {
                    $q->where('name', 'like', '%' . $this->search_name . '%');
                }
                if ($this->search_id) {
                    $q->where('id', 'like', '%' . $this->search_id . '%');
                }
                if ($this->searchFromDate && $this->searchToDate) {
                    $q->whereBetween('created_at', [$this->searchFromDate, $this->searchToDate]);
                }
                if ($this->search_service_type_id) {
                    $q->where('service_type_id', $this->search_service_type_id);
                }
            })
            ->orderBy('id', 'DESC')
            ->get();

        // Generate PDF
        $pdf = Pdf::loadView('livewire.laboratory.test_type_reports.pdf', [
            'services' => $query,
            'totalResults' => $query->count()
        ]);

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->stream();
        }, 'test-type-report.pdf');
    }

    // Print logic
    public function print()
    {
        // Store search filters in session for printing
        session()->put('print_filters', [
            'search_name' => $this->search_name,
            'search_id' => $this->search_id,
            'searchFromDate' => $this->searchFromDate,
            'searchToDate' => $this->searchToDate,
            'search_service_type_id' => $this->search_service_type_id,
        ]);
        
        // Return a JavaScript redirect to the print route
        return redirect()->route('livewire.laboratory.test_type_reports.print');
    }
}