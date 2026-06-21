<?php

namespace App\Livewire\General;

use App\Models\General\Department as GeneralDepartment;
use App\Models\General\Employee;
use App\Models\User;
use Livewire\Component;
use Illuminate\Support\Facades\Auth;
use Livewire\WithFileUploads;
use Livewire\WithPagination;

class Department extends Component
{
    use WithFileUploads, WithPagination;

    public $id, $name, $code, $department_head, $created_by, $updated_by, $deleted_by, $is_active, $is_delete;

    public $search = ''; // Add a search variable
    public $isOpen = 0;

    protected $paginationTheme = 'bootstrap'; // To use Bootstrap for pagination
    public $selectedDepartment;

    public function closeDetailsModal()
    {
        $this->selectedDepartment = null;
        $this->dispatch('close-modal', 'detailsModal');
    }

    public function updatingSearch()
    {
        $this->resetPage(); // Reset pagination when search query is updated
    }

    public function render()
    {
        // Add a search filter for both department name and creator's name
        $departments = GeneralDepartment::with(['created_by', 'updated_by', 'deleted_by'])
            ->where('is_delete', 0) // Only display records where is_delete is 0
            ->where(function ($query) {
                $query->where('name', 'like', '%' . $this->search . '%') // Search filter for department name
                      ->orWhereHas('created_by', function ($query) {
                          $query->where('name', 'like', '%' . $this->search . '%'); // Search filter for creator's name
                      });
            })
            ->paginate(10); // Paginate results (adjust as needed)

        return view('livewire.general.department', ['departments' => $departments]);
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
        $this->id = '';
        $this->name = '';
        $this->code = '';
        $this->is_active = 1;
    }

    public function add()
    {
        $this->validate([
            'name' => 'required',
            'code' => 'required',
            'is_active' => 'required|boolean',
        ]);

        $user_id = Auth::user()->id;

        GeneralDepartment::create([
            'name' => $this->name,
            'code' => $this->code,
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
        $data = GeneralDepartment::findOrFail($id);
        $this->id = $data->id;
        $this->name = $data->name;
        $this->code = $data->code;
        $this->is_active = $data->is_active;

        $this->openModal();
    }

    public function update()
    {
        $this->validate([
            'name' => 'required',
            'code' => 'required',
            'is_active' => 'required|boolean',
        ]);

        $data = GeneralDepartment::findOrFail($this->id);

        $data->update([
            'name' => $this->name,
            'code' => $this->code,
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
        $data = GeneralDepartment::findOrFail($id);
        $data->update(['is_delete' => 1]);
        $data->update(['deleted_by' => Auth::user()->id]);
        $this->dispatch('error', message: 'Record marked as deleted successfully.');
    }

}

