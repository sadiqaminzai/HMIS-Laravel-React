<?php

namespace App\Livewire\Reception;

use App\Models\General\Employee;
use App\Models\General\Fee;
use App\Models\Reception\FeesReceipt;
use App\Models\Reception\Patient;
use Livewire\Component;
use Illuminate\Support\Facades\Auth;
use Livewire\WithFileUploads;
use Livewire\WithPagination;

class FeeReceipt extends Component
{
    use WithFileUploads, WithPagination;

    public $id, $patient_id, $doctor_id, $fees_id, $discount, $discount_amount, $total_amount, $payment_status, $payment_method, $receipt_date, $created_by, $updated_by, $deleted_by, $is_active, $is_delete;

    public $search = ''; // Add a search variable
    public $isOpen = 0;
    public $selected_data;

    protected $paginationTheme = 'bootstrap'; // To use Bootstrap for pagination

    public function showDetails($id)
    {
        $this->selected_data = FeesReceipt::with('patient', 'employee', 'fees', 'user')->findOrFail($id);
        $this->dispatch('open-modal', 'detailsModal');

    }



    public function closeDetailsModal()
    {
        $this->selected_data = null;
        $this->dispatch('close-modal', 'detailsModal');
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
        $fees = Fee::where('is_active', 1)->where('is_delete', 0)->get();

        $fee_receipts_query = FeesReceipt::with('patient', 'employee', 'fees', 'user')
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
            $fee_receipts = $fee_receipts_query->orderBy('id','desc')->get();
        } else {
            $fee_receipts = $fee_receipts_query->orderBy('id','desc')->paginate(10); // Paginate results (adjust as needed)
        }

        return view('livewire.reception.fee-receipt', ['fee_receipts' => $fee_receipts, 'patients' => $patients, 'employees' => $employees, 'fees' => $fees]);
    }

    public function create()
    {
        $this->resetInputFields();
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
        $this->patient_id = '';
        $this->id = '';
        $this->doctor_id = '';
        $this->fees_id = '';
        $this->discount = false;
        $this->discount_amount = '';
        $this->total_amount = '';
        $this->payment_status = 'paid';
        $this->payment_method = 'cash';
        $this->receipt_date = '';
        $this->created_by = '';
        $this->updated_by = '';
        $this->is_active = 1;
    }

    public function add()
    {
        $this->validate([
            'patient_id' => 'required',
            'doctor_id' => 'required',
            'payment_status' => 'nullable|string',
            'payment_method' => 'nullable|string',
            'receipt_date' => 'nullable|date',
            'is_active' => 'required|boolean',
        ]);

        $user_id = Auth::user()->id;

        $fee = Fee::where('employee_id', $this->doctor_id)
                  ->firstOrFail();

        $total_amount = $fee->amount;
        $this->fees_id = $fee->id;
        $discount_amount = 0;

        if ($this->discount) {
            $discount_amount = $total_amount;
            $total_amount = 0;
        }


        FeesReceipt::create([
            'patient_id' => $this->patient_id,
            'doctor_id' => $this->doctor_id,
            'fees_id' => $this->fees_id,
            'discount_amount' => $discount_amount,
            'total_amount' => $total_amount,
            'payment_status' => $this->payment_status ?? 'pending',
            'payment_method' => $this->payment_method ?? 'cash',
            'receipt_date' => $this->receipt_date ? \Carbon\Carbon::parse($this->receipt_date)->format('Y-m-d') : now()->format('Y-m-d'),
            'is_active' => $this->is_active,
            'created_by' => $user_id,
        ]);

        $this->resetInputFields();
        $this->dispatch('close-modal');
        $this->dispatch('save-modal');
        $this->dispatch('success', ['message' => 'Record added successfully.']);
    }

    public function edit($id)
    {
        $data = FeesReceipt::findOrFail($id);
        $this->id = $id;
        $this->patient_id = $data->patient_id;
        $this->doctor_id = $data->doctor_id;
        $this->fees_id = $data->fees_id;
        $this->discount = $data->discount_amount > 0;
        $this->discount_amount = $data->discount_amount;
        $this->total_amount = $data->total_amount;
        $this->payment_status = $data->payment_status;
        $this->payment_method = $data->payment_method;
        $this->receipt_date = $data->receipt_date;
        $this->created_by = $data->created_by;
        $this->updated_by = $data->updated_by;
        $this->deleted_by = $data->deleted_by;
        $this->is_active = $data->is_active;

        $this->openModal();
    }

    public function update()
    {
        $this->validate([
            'patient_id' => 'required',
            'doctor_id' => 'required',
            'is_active' => 'required|boolean',
        ]);

        $data = FeesReceipt::findOrFail($this->id);

        $fee = Fee::where('employee_id', $this->doctor_id)->firstOrFail();
        $this->fees_id = $fee->id;
        $total_amount = $fee->amount;
        $discount_amount = 0;

        if ($this->discount) {
            $discount_amount = $total_amount;
            $total_amount = 0;
        } else {
            $discount_amount = 0;
        }

        $data->update([
            'patient_id' => $this->patient_id,
            'doctor_id' => $this->doctor_id,
            'fees_id' => $this->fees_id,
            'discount_amount' => $discount_amount,
            'total_amount' => $total_amount,
            'payment_status' => $this->payment_status ? $this->payment_status : 'pending',
            'payment_method' => $this->payment_method ? $this->payment_method : 'cash',
            'receipt_date' => $this->receipt_date ? \Carbon\Carbon::parse($this->receipt_date)->format('Y-m-d') : now()->format('Y-m-d'),
            'is_active' => $this->is_active,
            'updated_by' => Auth::user()->id,
        ]);

        $this->resetInputFields();
        $this->dispatch('close-modal');
        $this->dispatch('save-modal');
        $this->dispatch('success', ['message' => 'Record updated successfully.']);
    }

    public function delete($id)
    {
        $data = FeesReceipt::findOrFail($id);
        $data->update(['is_delete' => 1]);
        $data->update(['deleted_by' => Auth::user()->id]);
        $this->dispatch('error', message: 'Record marked as deleted successfully.');
    }
}
