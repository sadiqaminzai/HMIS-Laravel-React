<?php

namespace App\Livewire\Laboratory;

use App\Models\Laboratory\TestResult as LaboratoryTestResult;
use App\Models\Laboratory\TestResultDetails;
use App\Models\Laboratory\TestDetail as LaboratoryTestDetail;
use App\Models\General\Service;
use App\Models\Reception\ServiceReceipt;
use App\Models\Reception\ServiceReceiptDetail;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;
use Livewire\WithPagination;
use Maatwebsite\Excel\Facades\Excel;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;

class TestResultReport extends Component
{
    use WithPagination;

    public $id, $patient_service_id, $reporting_date, $remarks, $created_by, $updated_by, $is_active, $is_delete;
    
    // Search parameters
    public $search = ''; // General search term
    public $search_patient_name, $search_reporting_date, $searchFromDate, $searchToDate;
    public $isOpen = 0;
    public $selectedResult;
    public $test_results = []; // For storing test results
    public $searchResults = [];
    public $totalResults = 0;

    protected $paginationTheme = 'bootstrap';
    
    public function showDetails($id)
    {
        // Get service receipt details for displaying in the modal
        $this->selectedResult = ServiceReceipt::with([
            'patient',
            'employee',
            'service_receipt_details' => function ($query) {
                $query->whereHas('service', function ($query) {
                    $query->where('is_lab_test', 1);
                });
            },
            'service_receipt_details.service',
            'service_receipt_details.service_type',
            'user'
        ])->findOrFail($id);

        $this->dispatch('open-modal', 'detailsModal');
    }
    
    public function closeDetailsModal()
    {
        $this->selectedResult = null;
        $this->dispatch('close-modal', 'detailsModal');
    }

    // Show test result details
    public function showResult($id)
    {
        $user_id = Auth::user()->id;

        $this->selectedResult = ServiceReceipt::with([
            'patient',
            'employee',
            'service_receipt_details' => function ($query) {
                $query->whereHas('service', function ($query) {
                    $query->where('is_lab_test', 1);
                });
            },
            'service_receipt_details.service',
            'service_receipt_details.service_type',
            'user'
        ])->findOrFail($id);

        $this->patient_service_id = $this->selectedResult->id;

        // Load test results if they exist
        $testResult = LaboratoryTestResult::where('patient_service_id', $id)->first();
        if ($testResult) {
            foreach ($testResult->test_result_details as $detail) {
                $this->test_results[$detail->test_detail_id] = [
                    'result_value' => $detail->result_value,
                    'description' => $detail->description,
                ];
            }
            $this->reporting_date = $testResult->reporting_date;
            $this->remarks = $testResult->remarks;
        } else {
            $this->reporting_date = '';
            $this->remarks = '';
            $this->test_results = [];
        }

        $this->dispatch('open-modal', 'resultsModal');
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

    // Update the lab test status
    public function testStatus($id)
    {
        $data = ServiceReceipt::find($id);
        if ($data->lab_test_status == 1)
            $data->lab_test_status = 0;
        else
            $data->lab_test_status = 1;
        $data->save();
    }

    private function resetInputFields()
    {
        $this->id = '';
        $this->patient_service_id = '';
        $this->reporting_date = '';
        $this->remarks = '';
        $this->created_by = '';
        $this->updated_by = '';
        $this->is_active = '';
        $this->is_delete = '';
        $this->test_results = []; // Clear test results when resetting fields
        $this->search = '';
    }

    public function clearSearch()
    {
        $this->search = '';
        $this->search_patient_name = '';
        $this->search_reporting_date = '';
        $this->searchFromDate = '';
        $this->searchToDate = '';
        $this->resetPage();
    }

    public function searchDetails()
    {
        // Store search filters in session for printing
        session()->put('print_filters', [
            'search' => $this->search,
            'search_patient_name' => $this->search_patient_name,
            'search_reporting_date' => $this->search_reporting_date,
            'searchFromDate' => $this->searchFromDate,
            'searchToDate' => $this->searchToDate,
        ]);

        // Build the query for service receipts with lab tests
        $query = ServiceReceipt::with([
            'patient',
            'employee',
            'service_receipt_details' => function ($query) {
                $query->whereHas('service', function ($query) {
                    $query->where('is_lab_test', 1);
                });
            },
            'service_receipt_details.service',
            'service_receipt_details.service_type',
            'user'
        ])
        ->where('is_delete', 0)
        ->where('is_active', 1)
        ->whereHas('service_receipt_details.service', function ($query) {
            $query->where('is_lab_test', 1);
        });

        // Apply search filters
        if ($this->search) {
            $query->where(function($q) {
                $q->where('id', 'like', '%' . $this->search . '%')
                  ->orWhereHas('patient', function($query) {
                      $query->where('name', 'like', '%' . $this->search . '%')
                            ->orWhere('id', 'like', '%' . $this->search . '%');
                  });
            });
        }

        if ($this->search_patient_name) {
            $query->whereHas('patient', function ($q) {
                $q->where('name', 'like', '%' . $this->search_patient_name . '%');
            });
        }

        if ($this->search_reporting_date) {
            $query->where('receipt_date', $this->search_reporting_date);
        }

        if ($this->searchFromDate && $this->searchToDate) {
            $query->whereBetween('receipt_date', [$this->searchFromDate, $this->searchToDate]);
        }

        $this->searchResults = $query->orderBy('id', 'DESC')->get();
        $this->totalResults = $this->searchResults->count();

        $this->dispatch('open-search-modal');
    }

    public function closeSearchModal()
    {
        $this->dispatch('close-modal', 'searchModal');
    }

    public function render()
    {
        // Get all active lab test services
        $services = Service::where('is_delete', 0)->where('is_active', 1)->where('is_lab_test', 1)->get();
        $test_details = LaboratoryTestDetail::where('is_delete', 0)->where('is_active', 1)->get();

        // Build the query for service receipts with lab tests
        $service_receipts_query = ServiceReceipt::where('is_delete', 0)
            ->where('is_active', 1)
            ->whereHas('service_receipt_details.service', function ($query) {
                $query->where('is_lab_test', 1);
            });
        
        // Apply general search
        if ($this->search) {
            $service_receipts_query->where(function($q) {
                $q->where('id', 'like', '%' . $this->search . '%')
                  ->orWhereHas('patient', function($query) {
                      $query->where('name', 'like', '%' . $this->search . '%')
                            ->orWhere('id', 'like', '%' . $this->search . '%');
                  });
            });
        }
        
        // Apply specific filters
        if ($this->search_patient_name) {
            $service_receipts_query->whereHas('patient', function ($query) {
                $query->where('name', 'like', '%' . $this->search_patient_name . '%');
            });
        }

        if ($this->search_reporting_date) {
            $service_receipts_query->where('receipt_date', $this->search_reporting_date);
        }

        if ($this->searchFromDate && $this->searchToDate) {
            $service_receipts_query->whereBetween('receipt_date', [$this->searchFromDate, $this->searchToDate]);
        }

        // Get paginated results or all results based on search
        if ($this->search || $this->search_patient_name || $this->search_reporting_date || ($this->searchFromDate && $this->searchToDate)) {
            $service_receipts = $service_receipts_query->orderBy('id', 'desc')->get();
        } else {
            $service_receipts = $service_receipts_query->orderBy('id', 'desc')->paginate(10);
        }
        
        $service_receipt_details = ServiceReceiptDetail::all();

        // Get lab test results for the report section
        $test_results = LaboratoryTestResult::with([
            'service_receipt.patient', 
            'service_receipt.employee',
            'test_result_details.test_detail'
        ])
        ->where('is_delete', 0)
        ->where('is_active', 1)
        ->orderBy('id', 'DESC');

        if ($this->search_reporting_date) {
            $test_results->where('reporting_date', $this->search_reporting_date);
        }

        $results = $test_results->paginate(10);

        return view('livewire.laboratory.test-result-report', [
            'service_receipts' => $service_receipts,
            'service_receipt_details' => $service_receipt_details,
            'test_details' => $test_details,
            'services' => $services,
            'results' => $results,
        ]);
    }

    public function excel()
    {
        // Query for service receipts with lab tests based on search criteria
        $query = ServiceReceipt::with([
            'patient',
            'employee',
            'service_receipt_details.service',
            'service_receipt_details.service_type',
        ]);

        // Apply search filters
        if ($this->search) {
            $query->where(function($q) {
                $q->where('id', 'like', '%' . $this->search . '%')
                  ->orWhereHas('patient', function($query) {
                      $query->where('name', 'like', '%' . $this->search . '%')
                            ->orWhere('id', 'like', '%' . $this->search . '%');
                  });
            });
        }

        if ($this->search_patient_name) {
            $query->whereHas('patient', function ($q) {
                $q->where('name', 'like', '%' . $this->search_patient_name . '%');
            });
        }

        if ($this->search_reporting_date) {
            $query->where('receipt_date', $this->search_reporting_date);
        }

        if ($this->searchFromDate && $this->searchToDate) {
            $query->whereBetween('receipt_date', [$this->searchFromDate, $this->searchToDate]);
        }

        $results = $query->where('is_delete', 0)
            ->where('is_active', 1)
            ->whereHas('service_receipt_details.service', function ($query) {
                $query->where('is_lab_test', 1);
            })
            ->orderBy('id', 'DESC')
            ->get();
        
        // Add filename with date
        $filename = 'test_result_report_' . date('Y-m-d') . '.xlsx';
        
        // If no records found, show a message
        if ($results->isEmpty()) {
            session()->flash('message', 'No records found matching your search criteria.');
            return redirect()->back();
        }
        
        return Excel::download(new class($results) implements \Maatwebsite\Excel\Concerns\FromCollection, \Maatwebsite\Excel\Concerns\WithHeadings {
            protected $results;

            public function __construct($results)
            {
                $this->results = $results;
            }

            public function collection()
            {
                $data = $this->results->map(function ($receipt, $key) {
                    return [
                        'S.No' => $key + 1,
                        'Receipt ID' => $receipt->id ?? 'N/A',
                        'Patient Code' => $receipt->patient->id ?? 'N/A',
                        'Patient Name' => $receipt->patient->name ?? 'N/A',
                        'Doctor Name' => ($receipt->employee->first_name ?? '') . ' ' . ($receipt->employee->last_name ?? ''),
                        'Receipt Date' => $receipt->receipt_date ?? 'N/A',
                        'Receipt Status' => $receipt->lab_test_status == 1 ? 'Completed' : 'Pending',
                        'Payment Status' => $receipt->payment_status ?? 'N/A',
                        'Amount' => $receipt->net_amount ?? 'N/A',
                    ];
                });
                
                return $data;
            }

            public function headings(): array
            {
                return [
                    'S.No',
                    'Receipt ID',
                    'Patient Code',
                    'Patient Name',
                    'Doctor Name',
                    'Receipt Date',
                    'Receipt Status',
                    'Payment Status',
                    'Amount',
                ];
            }
        }, $filename);
    }

    // Export as PDF functionality
    public function pdf()
    {
        // Create query based on search filters
        $query = ServiceReceipt::with([
            'patient',
            'employee',
            'service_receipt_details.service',
            'service_receipt_details.service_type',
            'user'
        ]);

        // Apply search filters
        if ($this->search) {
            $query->where(function($q) {
                $q->where('id', 'like', '%' . $this->search . '%')
                  ->orWhereHas('patient', function($query) {
                      $query->where('name', 'like', '%' . $this->search . '%')
                            ->orWhere('id', 'like', '%' . $this->search . '%');
                  });
            });
        }

        if ($this->search_patient_name) {
            $query->whereHas('patient', function ($q) {
                $q->where('name', 'like', '%' . $this->search_patient_name . '%');
            });
        }

        if ($this->search_reporting_date) {
            $query->where('receipt_date', $this->search_reporting_date);
        }

        if ($this->searchFromDate && $this->searchToDate) {
            $query->whereBetween('receipt_date', [$this->searchFromDate, $this->searchToDate]);
        }

        $results = $query->where('is_delete', 0)
            ->where('is_active', 1)
            ->whereHas('service_receipt_details.service', function ($query) {
                $query->where('is_lab_test', 1);
            })
            ->orderBy('id', 'DESC')
            ->get();

        // Generate PDF
        $pdf = Pdf::loadView('livewire.laboratory.test_result_reports.pdf', [
            'service_receipts' => $results,
            'totalResults' => $results->count()
        ]);

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->stream();
        }, 'test-result-report.pdf');
    }

    // Print logic
    public function print()
    {
        // Get filters from session
        $filters = session('print_filters', []);

        // Build query based on filters
        $query = ServiceReceipt::with([
            'patient',
            'employee',
            'service_receipt_details.service',
            'service_receipt_details.service_type',
            'user'
        ])->where(function ($q) use ($filters) {
            if (!empty($filters['search'])) {
                $q->where(function($sq) use ($filters) {
                    $sq->where('id', 'like', '%' . $filters['search'] . '%')
                      ->orWhereHas('patient', function($query) use ($filters) {
                          $query->where('name', 'like', '%' . $filters['search'] . '%')
                                ->orWhere('id', 'like', '%' . $filters['search'] . '%');
                      });
                });
            }
            
            if (!empty($filters['search_patient_name'])) {
                $q->whereHas('patient', function ($subQ) use ($filters) {
                    $subQ->where('name', 'like', '%' . $filters['search_patient_name'] . '%');
                });
            }
            
            if (!empty($filters['search_reporting_date'])) {
                $q->where('receipt_date', $filters['search_reporting_date']);
            }
            
            if (!empty($filters['searchFromDate']) && !empty($filters['searchToDate'])) {
                $q->whereBetween('receipt_date', [
                    Carbon::createFromFormat('Y-m-d', $filters['searchFromDate'])->startOfDay(),
                    Carbon::createFromFormat('Y-m-d', $filters['searchToDate'])->endOfDay(),
                ]);
            }
        })
        ->where('is_delete', 0)
        ->where('is_active', 1)
        ->whereHas('service_receipt_details.service', function ($query) {
            $query->where('is_lab_test', 1);
        })
        ->orderBy('id', 'DESC')
        ->get();
        
        // Return view for printing
        return view('livewire.laboratory.test_result_reports.print', [
            'service_receipts' => $query,
            'totalResults' => $query->count()
        ]);
    }

    // Export a single test result as Excel
    public function exportSingleExcel($id)
    {
        $receipt = ServiceReceipt::with([
            'patient',
            'employee',
            'service_receipt_details.service',
            'service_receipt_details.service_type',
            'user'
        ])->findOrFail($id);

        // Check if there's a test result record
        $testResult = LaboratoryTestResult::where('patient_service_id', $id)->first();

        // Create filename with patient name and date
        $patientName = $receipt->patient->name ?? 'patient';
        $reportDate = date('Y-m-d');
        $filename = "test_result_{$patientName}_{$reportDate}.xlsx";
        
        return Excel::download(new class($receipt, $testResult) implements \Maatwebsite\Excel\Concerns\FromCollection, \Maatwebsite\Excel\Concerns\WithHeadings, \Maatwebsite\Excel\Concerns\WithTitle {
            protected $receipt;
            protected $testResult;

            public function __construct($receipt, $testResult)
            {
                $this->receipt = $receipt;
                $this->testResult = $testResult;
            }

            public function collection()
            {
                $data = collect();
                
                // Add patient and receipt information
                $data->push([
                    'Receipt ID', $this->receipt->id ?? 'N/A',
                    'Patient Code', $this->receipt->patient->id ?? 'N/A'
                ]);
                
                $data->push([
                    'Patient Name', $this->receipt->patient->name ?? 'N/A',
                    'Doctor Name', $this->receipt->employee->first_name . ' ' . 
                                   $this->receipt->employee->last_name ?? 'N/A'
                ]);
                
                $data->push([
                    'Receipt Date', $this->receipt->receipt_date ?? 'N/A',
                    'Receipt Status', $this->receipt->lab_test_status == 1 ? 'Completed' : 'Pending'
                ]);
                
                $data->push([
                    'Payment Method', $this->receipt->payment_method ?? 'N/A',
                    'Payment Status', $this->receipt->payment_status ?? 'N/A'
                ]);
                
                $data->push([
                    'Total Amount', $this->receipt->total_amount ?? 'N/A',
                    'Discount', $this->receipt->discount . '%' ?? 'N/A'
                ]);
                
                $data->push([
                    'Net Amount', $this->receipt->net_amount ?? 'N/A',
                    'Paid Amount', $this->receipt->paid_amount ?? 'N/A'
                ]);
                
                // Add a blank row
                $data->push(['']);
                
                // Add services header
                $data->push(['Lab Services']);
                $data->push(['S.N', 'Service Name', 'Service Type', 'Price']);
                
                // Add services data
                $serviceIndex = 1;
                foreach ($this->receipt->service_receipt_details as $service) {
                    $data->push([
                        $serviceIndex++,
                        $service->service->name ?? 'N/A',
                        $service->service_type->name ?? 'N/A',
                        $service->price ?? 'N/A'
                    ]);
                }
                
                // If test result exists, include test result details
                if ($this->testResult) {
                    // Add a blank row
                    $data->push(['']);
                    
                    // Add test results header
                    $data->push(['Test Results']);
                    $data->push(['S.N', 'Test Name', 'Normal Range', 'Unit', 'Result Value', 'Status']);
                    
                    // Add test results data
                    $testIndex = 1;
                    foreach ($this->testResult->test_result_details as $detail) {
                        $status = !empty($detail->result_value) ? 'Completed' : 'Pending';
                        $data->push([
                            $testIndex++,
                            $detail->test_detail->name ?? 'N/A',
                            $detail->test_detail->normal_range ?? 'N/A',
                            $detail->test_detail->unit ?? 'N/A',
                            $detail->result_value ?? 'N/A',
                            $status
                        ]);
                    }
                    
                    // Add remarks
                    $data->push(['']);
                    $data->push(['Remarks', $this->testResult->remarks ?? 'N/A']);
                }
                
                return $data;
            }

            public function headings(): array
            {
                return []; // No headings as we're creating a custom formatted report
            }
            
            public function title(): string
            {
                return 'Test Result Detail';
            }
        }, $filename);
    }

    // Export a single test result as PDF
    public function exportSinglePdf($id)
    {
        $receipt = ServiceReceipt::with([
            'patient',
            'employee',
            'service_receipt_details.service',
            'service_receipt_details.service_type',
            'user'
        ])->findOrFail($id);
        
        // Check if there's a test result record
        $testResult = LaboratoryTestResult::where('patient_service_id', $id)
            ->with('test_result_details.test_detail')
            ->first();
        
        // Generate PDF
        $pdf = Pdf::loadView('livewire.laboratory.test_result_reports.single_pdf', [
            'receipt' => $receipt,
            'testResult' => $testResult
        ]);

        // Create filename with patient name and date
        $patientName = $receipt->patient->name ?? 'patient';
        $reportDate = date('Y-m-d');
        $filename = "test_result_{$patientName}_{$reportDate}.pdf";

        return response()->streamDownload(function () use ($pdf) {
            echo $pdf->stream();
        }, $filename);
    }

    // Print a single test result
    public function printSingleResult($id)
    {
        // Store service receipt ID in session for printing
        session()->put('print_single_result', $id);
        
        // Open print page in new tab
        $this->dispatch('open-print-window', ['url' => url('/laboratory/test-result-single-print')]);
    }
}