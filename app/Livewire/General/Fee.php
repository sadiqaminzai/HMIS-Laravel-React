<?php

namespace App\Livewire\General;

use App\Models\General\Employee;
use App\Models\General\Fee as GeneralFee;
use Livewire\Component;
use Illuminate\Support\Facades\Auth;
use Livewire\WithFileUploads;
use Livewire\WithPagination;

class Fee extends Component
{
    public $id, $employee_id, $amount, $currency, $description, $created_by, $updated_by, $deleted_by, $is_active, $is_delete;

    public $search = ''; // Add a search variable
    public $isOpen = 0;
    

    protected $paginationTheme = 'bootstrap'; // To use Bootstrap for pagination

    public function updatingSearch()
    {
        $this->resetPage(); // Reset pagination when search query is updated
    }

    public function render()
    {
        $employees = Employee::where('is_delete', 0)
            ->where('is_active', 1)
            ->whereHas('designation', function ($query) {
                $query->where('name', 'like', '%doctor%');
            })
            ->get();
        $fees = GeneralFee::with(['employee', 'user'])
            ->where('is_delete', 0) // Only display records where is_delete is 0
            ->where(function ($query) {
            $query->whereHas('employee', function ($query) {
                $query->where('first_name', 'like', '%' . $this->search . '%')
                      ->orWhere('last_name', 'like', '%' . $this->search . '%'); // Search filter for employee's first name or last name
            })
            ->orWhereHas('user', function ($query) {
                $query->where('name', 'like', '%' . $this->search . '%'); // Search filter for creator's name
            });
            })
            ->paginate(10); // Paginate results (adjust as needed)

        return view('livewire.general.fee', ['fees' => $fees, 'employees' => $employees]);
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
        $this->employee_id = '';
        $this->amount = '';
        $this->currency = '';
        $this->description = '';
        $this->is_active = 1;
    }

    public function add()
    {
        $this->validate([
            'employee_id' => 'required',
            'amount' => 'required|numeric',
            'is_active' => 'required|boolean',
        ]);

        $user_id = Auth::user()->id;

        GeneralFee::create([
            'employee_id' => $this->employee_id ? $this->employee_id : null,
            'amount' => $this->amount,
            'currency' => $this->currency ? $this->currency : 'AFN',
            'description' => $this->description ? $this->description : null,
            'is_active' => $this->is_active,
            'created_by' => $user_id,
        ]);

        $this->resetInputFields();
        $this->dispatch('close-modal');
        $this->dispatch('save-modal');
        $this->dispatch('success', message: 'Record created successfully.');
    }

    public function edit($id)
    {
        $data = GeneralFee::findOrFail($id);
        $this->id = $data->id;
        $this->employee_id = $data->employee_id;
        $this->amount = $data->amount;
        $this->currency = $data->currency;
        $this->description = $data->description;
        $this->is_active = $data->is_active;

        $this->openModal();
    }

    public function update()
    {
        $this->validate([
            'employee_id' => 'required',
            'amount' => 'required|numeric',
            'is_active' => 'required|boolean',
        ]);

        $data = GeneralFee::findOrFail($this->id);

        $data->update([
            'employee_id' => $this->employee_id ? $this->employee_id : null,
            'amount' => $this->amount,
            'currency' => $this->currency ? $this->currency : 'AFN',
            'description' => $this->description ? $this->description : null,
            'is_active' => $this->is_active,
            'updated_by' => Auth::user()->id,
        ]);

        $this->resetInputFields();
        $this->dispatch('close-modal');
        $this->dispatch('save-modal');
        $this->dispatch('success', message: 'Record updated successfully.');
    }

    public function delete($id)
    {
        $data = GeneralFee::findOrFail($id);
        $data->update(['is_delete' => 1]);
        $this->dispatch('error', message: 'Record marked as deleted successfully.');
    }
}