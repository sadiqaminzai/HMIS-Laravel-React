<?php

namespace App\Livewire\Reception;

use App\Models\General\Employee;
use App\Models\General\Service;
use App\Models\General\ServiceType;
use App\Models\Reception\Patient;
use App\Models\Reception\ServiceReceipt as ReceptionServiceReceipt;
use App\Models\Reception\ServiceReceiptDetail;
use Livewire\Component;
use Illuminate\Support\Facades\Auth;
use Livewire\WithFileUploads;
use Livewire\WithPagination;

class ServiceReceipt extends Component
{
    use WithFileUploads, WithPagination;

    public $id, $patient_id, $service_id, $service_type_id, $doctor_id, $discount, $discount_amount, $discount_reason, $total_amount, $net_amount, $paid_amount, $due_amount,
        $payment_status, $payment_method, $receipt_date, $created_by, $updated_by, $deleted_by, $is_active, $is_delete;
    public $service_receipt_id, $quantity, $price, $total;

    public $serviceReceiptDetails = [
        ['service_id' => '', 'service_type_id' => '', 'quantity' => '', 'price' => '', 'total' => '']
    ];

    public $search = '';
    public $isOpen = 0;
    public $selected_data;


    public $isEditing = false;
    public $isStoring = false;
    public $isUpdating = false;

    public $isChangesEnabled = false;

    public function isChangesEnabled()
    {
        return $this->service_receipt_id ? false : true;
    }

    public function enableEditing()
    {
        $this->isEditing = true;
        $this->receipt_date = now()->format('Y-m-d');
    }

    public function disableEditing()
    {
        $this->isEditing = false;
    }



    public function addItem()
    {
        $this->calculateTotals();
        $this->serviceReceiptDetails[] = [
            'service_id' => '',
            'service_type_id' => '',
            'quantity' => '',
            'price' => '',
            'total' => ''
        ];
    }

    public function removeServiceReceiptDetail($index)
    {
        unset($this->serviceReceiptDetails[$index]);
        $this->serviceReceiptDetails = array_values($this->serviceReceiptDetails); // Reindex the array
        $this->calculateTotals(); // Recalculate totals
    }

    public function calculateTotals()
    {
        $this->quantity = 0;
        $this->total = 0.00;

        foreach ($this->serviceReceiptDetails as $detail) {
            $quantity = (float) ($detail['quantity'] ?? 0);
            $salePrice = (float) ($detail['price'] ?? 0);

            $this->quantity += $quantity;
            $this->total += $quantity * $salePrice;
        }

        $this->total_amount = $this->total;

        // Ensure discount is between 0 and 100
        if ($this->discount < 0 || $this->discount > 100) {
            $this->discount = 0;
        }

        $this->discount_amount = ($this->total_amount * $this->discount) / 100;
        $this->net_amount = $this->total_amount - $this->discount_amount;

        if ($this->payment_status == 'paid') {
            $this->paid_amount = $this->net_amount;
        } else {
            $this->paid_amount = 0;
        }

        $this->due_amount = $this->net_amount - $this->paid_amount;
    }


    public function updatedDiscount()
    {
        $this->calculateTotals(); // Recalculate totals whenever the discount value changes in real-time
    }

    public function calculateItemAmount($index)
    {
        $quantity = (float) ($this->serviceReceiptDetails[$index]['quantity'] ?? 0);
        $salePrice = (float) ($this->serviceReceiptDetails[$index]['price'] ?? 0);
        $this->serviceReceiptDetails[$index]['total'] = ($quantity * $salePrice);
        $this->calculateTotals();
    }

    public function cancel_store()
    {
        $this->resetFormState();
    }

    public function cancel_update()
    {
        $this->resetFormState();
    }

    private function resetFormState()
    {
        $this->resetInputFields(); // Reset all fields to their default values
        $this->resetValidation();  // Clear validation errors, if any
        $this->isChangesEnabled = false;
        $this->isStoring = false;
        $this->isUpdating = false;
        $this->isEditing = false;
    }

    protected $paginationTheme = 'bootstrap';

    public function showDetails($id)
    {
        $this->selected_data = ReceptionServiceReceipt::with([
            'patient',
            'employee',
            'service_receipt_details.service',
            'service_receipt_details.service_type',
            'user'
        ])->findOrFail($id);

        $this->dispatch('open-modal', 'detailsModal');
    }

    public function closeDetailsModal()
    {
        $this->selected_data = null;
        $this->dispatch('close-modal', 'detailsModal');
    }

    public function updatingSearch()
    {
        $this->resetPage(); // Reset pagination when search query is updated
    }

    public function fetchServiceDetails($index)
    {
        if (isset($this->serviceReceiptDetails[$index]['service_id'])) {
            // Get the service ID from the serviceReceiptDetails array
            $serviceId = $this->serviceReceiptDetails[$index]['service_id'];
            // Fetch the service details
            $service = Service::where('id', $serviceId)->where('is_active', 1)->where('is_delete', 0)->first();

            // Get the service type ID from the serviceReceiptDetails array
            $serviceTypeId = $this->serviceReceiptDetails[$index]['service_type_id'];
            // Fetch the service type details
            $serviceType = ServiceType::where('id', $serviceTypeId)->where('is_active', 1)->where('is_delete', 0)->first();

            // Update the serviceReceiptDetails array with the fetched service details
            if ($service) {
                $this->serviceReceiptDetails[$index]['name'] = $service->name;
                $this->serviceReceiptDetails[$index]['service_type_id'] = $service->service_type_id;
                $this->serviceReceiptDetails[$index]['quantity'] = 1;
                $this->serviceReceiptDetails[$index]['price'] = $service->amount;
                $this->serviceReceiptDetails[$index]['total'] = $service->amount * $this->serviceReceiptDetails[$index]['quantity'];
            } else {
                $this->serviceReceiptDetails[$index]['name'] = '';
                $this->serviceReceiptDetails[$index]['service_type_id'] = '';
                $this->serviceReceiptDetails[$index]['quantity'] = '';
                $this->serviceReceiptDetails[$index]['price'] = '';
                $this->serviceReceiptDetails[$index]['total'] = '';
            }

            // Recalculate the overall totals
            $this->calculateTotals();
        }
    }

    public function render()
    {
        $patients = Patient::where('is_active', 1)->where('is_delete', 0)->orderBy('id', 'desc')->get();
        $employees = Employee::where('is_delete', 0)->where('is_active', 1)
            ->whereHas('designation', function ($query) {
                $query->where('name', 'like', '%doctor%');
            })->orderBy('first_name')->get();
        $services = Service::where('is_active', 1)->where('is_delete', 0)->get();

        $service_types = ServiceType::where('is_active', 1)->where('is_delete', 0)->get();

        $service_receipt_details = ServiceReceiptDetail::all();

        $service_receipts = ReceptionServiceReceipt::with('patient', 'employee', 'service', 'user')
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
            })
            ->orderBy('id','desc')->paginate(10); // Paginate results (adjust as needed)

        return view('livewire.reception.service-receipt', [
            'service_receipts' => $service_receipts,
            'service_receipt_details' => $service_receipt_details,
            'patients' => $patients,
            'employees' => $employees,
            'services' => $services,
            'service_types' => $service_types
        ]);
    }

    public function create()
    {
        $this->resetInputFields();
        $this->isChangesEnabled = true;
        $this->isStoring = true;
        $this->enableEditing();
        $this->openModal();
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
        $this->patient_id = '';
        $this->service_id = '';
        $this->doctor_id = '';
        $this->discount = 0;
        $this->discount_amount = 0;
        $this->discount_reason = '';
        $this->total_amount = 0;
        $this->net_amount = 0;
        $this->paid_amount = 0;
        $this->due_amount = 0;
        $this->payment_status = 'paid';
        $this->payment_method = 'cash';
        $this->receipt_date = '';
        $this->created_by = '';
        $this->updated_by = '';
        $this->is_active = 1;
        $this->is_delete = 0;

        $this->serviceReceiptDetails = [
            ['service_id' => '', 'service_type_id' => '', 'quantity' => '', 'price' => '', 'total' => '']
        ];
    }

    protected $rules = [
        'patient_id' => 'required',
        'doctor_id' => 'required',
        'is_active' => 'required|boolean',
        'payment_status' => 'required',
        'payment_method' => 'required',
        'serviceReceiptDetails.*.service_id' => 'required|exists:services,id',
        'serviceReceiptDetails.*.service_type_id' => 'required|exists:service_types,id',
        'serviceReceiptDetails.*.quantity' => 'required|integer|min:1|max:1',
        'serviceReceiptDetails.*.price' => 'required|numeric|min:0',
        'serviceReceiptDetails.*.total' => 'required|numeric|min:0',
    ];

    public function store()
    {
        $this->validate(); // This will use the rules defined in the $rules property

        $userId = Auth::id(); // Get the authenticated user ID

        // Create the service receipt
        $serviceReceipt = ReceptionServiceReceipt::create([
            'patient_id' => $this->patient_id,
            'doctor_id' => $this->doctor_id,
            'discount' => $this->discount ?? 0,
            'discount_amount' => $this->discount_amount ?? 0,
            'total_amount' => $this->total_amount,
            'net_amount' => $this->net_amount,
            'paid_amount' => $this->paid_amount,
            'due_amount' => $this->due_amount,
            'payment_status' => $this->payment_status,
            'payment_method' => $this->payment_method,
            'receipt_date' => $this->receipt_date ? \Carbon\Carbon::parse($this->receipt_date)->format('Y-m-d') : now()->format('Y-m-d'),
            'is_active' => $this->is_active,
            'created_by' => $userId,
        ]);

        // Loop through serviceReceiptDetails and save each as a detail record
        foreach ($this->serviceReceiptDetails as $detail) {
            ServiceReceiptDetail::create([
                'service_receipt_id' => $serviceReceipt->id,
                'service_id' => $detail['service_id'],
                'service_type_id' => $detail['service_type_id'],
                'quantity' => $detail['quantity'],
                'price' => $detail['price'],
                'total' => $detail['total'],
            ]);
        }

        $this->resetInputFields();
        //calculateItemAmount(); calling this method to calculate the total amount


        $this->dispatch('close-modal');
        $this->dispatch('save-modal');
        $this->dispatch('success', ['message' => 'Service receipt created successfully.']);
    }

    public function edit($id)
    {

        $this->disableEditing();
        $this->isChangesEnabled = true;
        $this->isUpdating = true;
        $this->enableEditing();

        $data = ReceptionServiceReceipt::with('service_receipt_details')->findOrFail($id);
        $this->id = $id;
        $this->patient_id = $data->patient_id;
        $this->doctor_id = $data->doctor_id;
        $this->service_id = $data->service_id;
        $this->discount = $data->discount;
        $this->discount_amount = $data->discount_amount;
        $this->total_amount = $data->total_amount;
        $this->net_amount = $data->net_amount;
        $this->paid_amount = $data->paid_amount;
        $this->due_amount = $data->due_amount;
        $this->payment_status = $data->payment_status;
        $this->payment_method = $data->payment_method;
        $this->receipt_date = $data->receipt_date;
        $this->created_by = $data->created_by;
        $this->updated_by = $data->updated_by;
        $this->deleted_by = $data->deleted_by;
        $this->is_active = $data->is_active;

        // Load service receipt details
        $this->serviceReceiptDetails = []; // Reset the serviceReceiptDetails array
        foreach ($data->service_receipt_details as $detail) {
            $this->serviceReceiptDetails[] = [
                'service_id' => $detail->service_id,
                'service_type_id' => $detail->service_type_id,
                'quantity' => $detail->quantity,
                'price' => $detail->price,
                'total' => $detail->total,
            ];
        }

        $this->openModal();
    }

    public function update()
    {
        $this->validate(); // This will use the rules defined in the $rules property

        $userId = Auth::id(); // Get the authenticated user ID

        // Update the service receipt
        $serviceReceipt = ReceptionServiceReceipt::findOrFail($this->id);
        $serviceReceipt->update([
            'patient_id' => $this->patient_id,
            'doctor_id' => $this->doctor_id,
            'discount' => $this->discount ?? 0,
            'discount_amount' => $this->discount_amount ?? 0,
            'total_amount' => $this->total_amount,
            'net_amount' => $this->net_amount,
            'paid_amount' => $this->paid_amount,
            'due_amount' => $this->due_amount,
            'payment_status' => $this->payment_status,
            'payment_method' => $this->payment_method,
            'receipt_date' => $this->receipt_date ? \Carbon\Carbon::parse($this->receipt_date)->format('Y-m-d') : now()->format('Y-m-d'),
            'is_active' => $this->is_active,
            'updated_by' => $userId,
        ]);

        // Delete existing service receipt details
        ServiceReceiptDetail::where('service_receipt_id', $serviceReceipt->id)->delete();

        // Loop through serviceReceiptDetails and save each as a detail record
        foreach ($this->serviceReceiptDetails as $detail) {
            ServiceReceiptDetail::create([
                'service_receipt_id' => $serviceReceipt->id,
                'service_id' => $detail['service_id'],
                'service_type_id' => $detail['service_type_id'],
                'quantity' => $detail['quantity'],
                'price' => $detail['price'],
                'total' => $detail['total'],
            ]);
        }

        $this->resetInputFields();
        $this->dispatch('close-modal');
        $this->dispatch('save-modal');
        $this->dispatch('success', ['message' => 'Record updated successfully.']);
    }

    public function delete($id)
    {
        $data = ReceptionServiceReceipt::findOrFail($id);
        $data->update(['is_delete' => 1]);
        $data->update(['deleted_by' => Auth::user()->id]);
        $this->dispatch('error', message: 'Record marked as deleted successfully.');
    }
}
