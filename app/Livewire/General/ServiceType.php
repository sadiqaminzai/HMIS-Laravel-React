<?php

namespace App\Livewire\General;

use App\Models\General\ServiceType as GeneralServiceType;
use Livewire\Component;
use Illuminate\Support\Facades\Auth;
use Livewire\WithFileUploads;
use Livewire\WithPagination;

class ServiceType extends Component
{

    public $id, $name, $details, $created_by, $updated_by, $deleted_by, $is_active, $is_delete;

    public $search = ''; // Add a search variable
    public $isOpen = 0;

    protected $paginationTheme = 'bootstrap'; // To use Bootstrap for pagination

    public function updatingSearch()
    {
        $this->resetPage(); // Reset pagination when search query is updated
    }

    public function render()
    {
        // Add a search filter
        $service_types = GeneralServiceType::with(['user'])
            ->where('is_delete', 0) // Only display records where is_delete is 0
            ->where(function ($query) {
                $query->where('name', 'like', '%' . $this->search . '%') // Search filter for service_types type
                      ->orWhereHas('user', function ($query) {
                          $query->where('name', 'like', '%' . $this->search . '%'); // Search filter for creator's name
                      });
            })
            ->paginate(10); // Paginate results (adjust as needed)

        return view('livewire.general.service-type', ['service_types' => $service_types]);
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
        $this->id = null;
        $this->name = '';
        $this->details = '';
        $this->is_active = 1;
    }

    public function add()
    {
        $this->validate([
            'name' => 'required',
            'is_active' => 'required|boolean',
        ]);

        $user_id = Auth::user()->id;

        GeneralServiceType::create([
            'name' => $this->name,
            'details' => $this->details ? $this->details : null,
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
        $data = GeneralServiceType::findOrFail($id);
        $this->id = $data->id;
        $this->name = $data->name;
        $this->details = $data->details;
        $this->is_active = $data->is_active;

        $this->openModal();
    }

    public function update()
    {
        $this->validate([
            'name' => 'required',
            'is_active' => 'required|boolean',
        ]);

        $data = GeneralServiceType::findOrFail($this->id);

        $data->update([
            'name' => $this->name,
            'details' => $this->details ? $this->details : null,
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
        $data = GeneralServiceType::findOrFail($id);
        $data->update(['is_delete' => 1]);
        $data->update(['deleted_by' => Auth::user()->id]);
        $this->dispatch('error', message: 'Record marked as deleted successfully.');
    }
}