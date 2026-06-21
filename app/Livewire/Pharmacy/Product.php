<?php

namespace App\Livewire\Pharmacy;

use App\Models\Pharmacy\Company;
use App\Models\Pharmacy\Packing;
use App\Models\Pharmacy\Product as PharmacyProduct;
use Illuminate\Support\Facades\Auth;
use Livewire\WithFileUploads;
use Livewire\WithPagination;

use Livewire\Component;

class Product extends Component
{
    use WithFileUploads, WithPagination;

    public $id, $name, $cost_price, $sale_price, $packing_id, $company_id, $location, $created_by, $updated_by, $deleted_by, $is_active, $is_delete;

    public $search = ''; // Add a search variable
    public $isOpen = 0;

    protected $paginationTheme = 'bootstrap'; // To use Bootstrap for pagination

    public function updatingSearch()
    {
        $this->resetPage(); // Reset pagination when search query is updated
    }

    public function render()
    {
        $companies = Company::where('is_delete', 0)->where('is_active', 1)->get();
        $packings = Packing::where('is_delete', 0)->where('is_active', 1)->get();
        $products = PharmacyProduct::with(['user','company','packing'])
            ->where('is_delete', 0) // Only display records where is_delete is 0
            ->where(function ($query) {
                $query->where('name', 'like', '%' . $this->search . '%') // Search filter for department name
                      ->orWhereHas('user', function ($query) {
                          $query->where('name', 'like', '%' . $this->search . '%'); // Search filter for creator's name
                      });
            })
            ->paginate(10); // Paginate results (adjust as needed)

        return view('livewire.pharmacy.product', ['products' => $products, 'companies' => $companies, 'packings' => $packings]);
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
        $this->cost_price = '';
        $this->sale_price = '';
        $this->packing_id = '';
        $this->company_id = '';
        $this->location = '';
        $this->is_active = 1; // Default value
    }

    public function add()
    {
        $this->validate([
            'name' => 'required',
            'cost_price' => 'required',
            'sale_price' => 'required',
            'company_id' => 'required',
            'is_active' => 'required|boolean',
        ]);

        $user_id = Auth::user()->id;

        PharmacyProduct::create([
            'name' => $this->name,
            'cost_price' => $this->cost_price,
            'sale_price' => $this->sale_price,
            'packing_id' => $this->packing_id ? $this->packing_id : null,
            'company_id' => $this->company_id,
            'location' => $this->location ? $this->location : null,
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
        $data = PharmacyProduct::findOrFail($id);
        $this->id = $data->id;
        $this->name = $data->name;
        $this->cost_price = $data->cost_price;
        $this->sale_price = $data->sale_price;
        $this->packing_id = $data->packing_id;
        $this->company_id = $data->company_id;
        $this->location = $data->location;
        $this->is_active = $data->is_active;

        $this->openModal();
    }

    public function update()
    {
        $this->validate([
            'name' => 'required',
            'cost_price' => 'required',
            'sale_price' => 'required',
            'company_id' => 'required',
            'is_active' => 'required|boolean',
        ]);

        $data = PharmacyProduct::findOrFail($this->id);

        $data->update([
            'name' => $this->name,
            'cost_price' => $this->cost_price,
            'sale_price' => $this->sale_price,
            'packing_id' => $this->packing_id ? $this->packing_id : null,
            'company_id' => $this->company_id,
            'location' => $this->location ? $this->location : null,
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
        $data = PharmacyProduct::findOrFail($id);
        $data->update(['is_delete' => 1]);
        $this->dispatch('error', message: 'Record marked as deleted successfully.');
    }
}

