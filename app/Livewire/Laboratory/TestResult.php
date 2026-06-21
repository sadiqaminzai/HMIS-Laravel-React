<?php

namespace App\Livewire\Laboratory;

use App\Models\General\Service;
use App\Models\Laboratory\TestDetail as LaboratoryTestDetail;
use App\Models\Laboratory\TestResult as LaboratoryTestResult;
use App\Models\Laboratory\TestResultDetails;
use App\Models\Reception\ServiceReceipt;
use App\Models\Reception\ServiceReceiptDetail;
use Illuminate\Support\Facades\Auth;

use Livewire\Component;

class TestResult extends Component
{
    //test results
    public $id, $patient_service_id, $reporting_date, $remarks, $created_by, $updated_by, $deleted_by, $is_active, $is_delete;
    public $test_results = []; // Define the test_results property

    //test result details
    public $test_result_id, $test_detail_id, $result_value, $description;

    //service as test name
    public $name, $service_type_id, $amount, $currency, $is_lab_test;
    //test details
    public $test_type_id, $normal_range, $unit;

    //selected data
    public $selected_data;

    //default reporting_date
    public function __construct()
    {
        $this->reporting_date = now()->format('Y-m-d');
    }

    public $search = ''; // Add a search variable
    public $isOpen = 0;

    protected $paginationTheme = 'bootstrap';

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

    public function render()
    {
        // Get all active lab test services
        $services = Service::where('is_delete', 0)->where('is_active', 1)->where('is_lab_test', 1)->get();
        $test_details = LaboratoryTestDetail::where('is_delete', 0)->where('is_active', 1)->get();

        // Add a search filter for service receipts
        $service_receipts_query = ServiceReceipt::where('is_delete', 0)
            ->where('is_active', 1)
            ->whereHas('service_receipt_details.service', function ($query) {
                $query->where('is_lab_test', 1);
            })
            ->where(function ($query) {
                $query->where('id', 'like', '%' . $this->search . '%')
                    ->orWhereHas('patient', function ($query) {
                        $query->where('name', 'like', '%' . $this->search . '%');
                    });
            });

        // Apply pagination or get all results based on the presence of the search term
        if ($this->search) {
            $service_receipts = $service_receipts_query->orderBy('id','desc')->get();
        } else {
            $service_receipts = $service_receipts_query->orderBy('id','desc')->paginate(10);
        }

        $service_receipt_details = ServiceReceiptDetail::all();

        return view('livewire.laboratory.test-result', [
            'service_receipts' => $service_receipts,
            'service_receipt_details' => $service_receipt_details,
            'test_details' => $test_details,
            'services' => $services,
            'search' => $this->search // Ensure search is passed to the view
        ]);
    }

    //Lab Test Status
    public function testStatus($id)
    {
        $data = ServiceReceipt::find($id);
        if ($data->lab_test_status == 1)
            $data->lab_test_status = 0;
        else
            $data->lab_test_status = 1;
        $data->save();
    }

    // showing services details for Lab tests
    public function showDetails($id)
    {
        $this->selected_data = ServiceReceipt::with([
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
    // reset/hide services details for Lab tests
    public function closeDetailsModal()
    {
        $this->selected_data = null;
        $this->dispatch('close-modal', 'detailsModal');
    }

    public function showResult($id)
    {
        $user_id = Auth::user()->id;

        $this->selected_data = ServiceReceipt::with([
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

        $this->patient_service_id = $this->selected_data->id;

        // Load test details for each service and their existing test results
        foreach ($this->selected_data->service_receipt_details as $detail) {
            $detail->test_details = LaboratoryTestDetail::where('test_type_id', $detail->service->id)
                ->where('is_delete', 0)
                ->where('is_active', 1)
                ->whereHas('service', function ($query) {
                    $query->where('is_lab_test', 1);
                })
                ->get();

            // Load existing test results for each test detail
            foreach ($detail->test_details as $test_detail) {
                $test_result = TestResultDetails::where('test_detail_id', $test_detail->id)
                    ->whereHas('test_result', function ($query) use ($id) {
                        $query->where('patient_service_id', $id);
                    })
                    ->first();

                if ($test_result) {
                    $this->test_results[$test_detail->id] = [
                        'result_value' => $test_result->result_value,
                        'description' => $test_result->description,
                    ];
                } else {
                    $this->test_results[$test_detail->id] = [
                        'result_value' => '',
                        'description' => '',
                    ];
                }
            }
        }
        // Load the TestResult for the service receipt
        $testResult = LaboratoryTestResult::where('patient_service_id', $id)->first();
        if ($testResult) {
            $this->reporting_date = $testResult->reporting_date;
            $this->remarks = $testResult->remarks;
        } else {
            $this->reporting_date = '';
            $this->remarks = '';
        }

        $this->dispatch('open-modal', 'resultsModal');
    }

    public function store()
    {
        $this->validate([
            'reporting_date' => 'required|date',
            'remarks' => 'nullable|string|max:255',
            'test_results.*.result_value' => 'nullable|string|max:255',
            'test_results.*.description' => 'nullable|string|max:255',
        ]);

        // Check if a TestResult already exists using the hidden input's patient_service_id
        $testResult = LaboratoryTestResult::firstOrNew(['patient_service_id' => $this->patient_service_id]);

        // Populate fields for TestResult (insert or update)
        $testResult->reporting_date = $this->reporting_date;
        $testResult->remarks = $this->remarks;
        $testResult->created_by = $testResult->exists ? $testResult->created_by : Auth::id();
        $testResult->updated_by = Auth::id();
        $testResult->is_active = 1;
        $testResult->is_delete = 0;
        $testResult->save();

        // Handle each test result detail
        foreach ($this->test_results as $test_detail_id => $result_data) {
            // Use the hidden input field's ID (test_detail_id) to check existence
            $testResultDetail = TestResultDetails::firstOrNew([
                'test_result_id' => $testResult->id,
                'test_detail_id' => $test_detail_id, // Compare hidden input ID
            ]);

            // Update or set fields
            $testResultDetail->result_value = $result_data['result_value'] ?? null;
            $testResultDetail->description = $result_data['description'] ?? null;
            $testResultDetail->created_by = $testResultDetail->exists ? $testResultDetail->created_by : Auth::id();
            $testResultDetail->updated_by = Auth::id();
            $testResultDetail->is_active = 1;
            $testResultDetail->is_delete = 0;
            $testResultDetail->save();
        }

        // Provide feedback and reset modal

        $this->dispatch('close-modal');
        $this->dispatch('save-modal');
        $this->dispatch('success', message: 'Record Saved successfully.');
    }

    // reset/hide services details for Lab tests
    public function closeResultsModal()
    {
        $this->selected_data = null;
        $this->dispatch('close-modal', 'resultsModal');
    }
}
