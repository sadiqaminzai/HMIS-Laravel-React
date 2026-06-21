<?php

namespace App\Livewire\Pharmacy;

use App\Models\Pharmacy\Supplier as PharmacySupplier;
use Illuminate\Support\Facades\Auth;
use Livewire\WithFileUploads;
use Livewire\WithPagination;


use Livewire\Component;

class Supplier extends Component
{
    use WithFileUploads, WithPagination;

    public $id, $name, $phone, $email, $address, $company_name, $created_by, $updated_by, $deleted_by, $is_active, $is_delete;


    public $search = ''; // Add a search variable
    public $isOpen = 0;
    public $selectedSupplier;

    protected $paginationTheme = 'bootstrap'; // To use Bootstrap for pagination
    public function showDetails($id)
    {
        $this->selectedSupplier = PharmacySupplier::with('user')->findOrFail($id);
        $this->dispatch('open-modal', 'detailsModal');
    }
    public function closeDetailsModal()
    {
        $this->selectedSupplier = null;
        $this->dispatch('close-modal', 'detailsModal');
    }

    public function updatingSearch()
    {
        $this->resetPage(); // Reset pagination when search query is updated
    }

    public function render()
    {
        // Add a search filter
        $suppliers = PharmacySupplier::with('user')
            ->where('is_delete', 0) // Only display records where is_delete is 0
            ->where(function ($query) {
                $query->where('name', 'like', '%' . $this->search . '%') // Search filter for department name
                      ->orWhereHas('user', function ($query) {
                          $query->where('name', 'like', '%' . $this->search . '%'); // Search filter for creator's name
                      });
            })
            ->paginate(10); // Paginate results (adjust as needed)

        return view('livewire.pharmacy.supplier', ['suppliers' => $suppliers]);
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
        $this->name = '';
        $this->phone = '';
        $this->email = '';
        $this->address = '';
        $this->company_name = '';
        $this->is_active = 1; // Default value
    }

    public function add()
    {
        $this->validate([
            'name' => 'required',
            'phone' => 'required',
            'is_active' => 'required|boolean',
        ]);

        $user_id = Auth::user()->id;

        PharmacySupplier::create([
            'name' => $this->name,
            'phone' => $this->phone,
            'email' => $this->email,
            'address' => $this->address,
            'company_name' => $this->company_name,
            'created_by' => $user_id,
            'is_active' => $this->is_active,
        ]);

        $this->resetInputFields();
        $this->dispatch('close-modal');
        $this->dispatch('save-modal');
        $this->dispatch('success', message: 'Record created successfully.');
    }

    public function update()
    {
        $this->validate([
            'name' => 'required',
            'phone' => 'required',
            'is_active' => 'required|boolean',
        ]);

        $data = PharmacySupplier::findOrFail($this->id);

        $data->update([
            'name' => $this->name,
            'phone' => $this->phone,
            'email' => $this->email,
            'address' => $this->address,
            'company_name' => $this->company_name,
            'updated_by' => Auth::user()->id,
            'is_active' => $this->is_active,
        ]);

        $this->resetInputFields();
        $this->dispatch('close-modal');
        $this->dispatch('save-modal');
        $this->dispatch('success', message: 'Record updated successfully.');
    }

    public function edit($id)
    {
        $data = PharmacySupplier::findOrFail($id);
        $this->id = $data->id;
        $this->name = $data->name;
        $this->phone = $data->phone;
        $this->email = $data->email;
        $this->address = $data->address;
        $this->company_name = $data->company_name;
        $this->is_active = $data->is_active;

        $this->openModal();
    }

    public function delete($id)
    {
        $data = PharmacySupplier::findOrFail($id);
        $data->update(['is_delete' => 1]);
        $this->dispatch('error', message: 'Record marked as deleted successfully.');
    }
}

