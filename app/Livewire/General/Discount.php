<?php

namespace App\Livewire\General;

use App\Models\General\Discount as GeneralDiscount;
use App\Models\General\DiscountType;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;

class Discount extends Component
{

    public $id, $name, $discount_type_id, $description, $amount, $currency, $created_by, $updated_by, $deleted_by, $is_active, $is_delete;

    public $search = ''; // Add a search variable
    public $isOpen = 0;

    protected $paginationTheme = 'bootstrap'; // To use Bootstrap for pagination

    public function updatingSearch()
    {
        $this->resetPage(); // Reset pagination when search query is updated
    }

    public function render()
    {
        //Use is_delete, is_active conditions to display only active records
        $discount_types = DiscountType::where('is_delete', 0)->where('is_active', 1)->get();
        // Add a search filter
        $discounts = GeneralDiscount::with(['user','discount_type'])
            ->where('is_delete', 0) // Only display records where is_delete is 0
            ->where(function ($query) {
                $query->where('name', 'like', '%' . $this->search . '%') // Search filter for discounts type
                      ->orWhereHas('user', function ($query) {
                          $query->where('name', 'like', '%' . $this->search . '%'); // Search filter for creator's name
                      });
            })
            ->paginate(10); // Paginate results (adjust as needed)

        return view('livewire.general.discount', ['discounts' => $discounts, 'discount_types' => $discount_types]);
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
        $this->discount_type_id = '';
        $this->description = '';
        $this->amount = '';
        $this->currency = '';
        $this->is_active = 1;
    }

    public function add()
    {
        $this->validate([
            'name' => 'required',
            'discount_type_id' => 'required',
            'amount' => 'required|numeric',
            'is_active' => 'required|boolean',
        ]);

        $user_id = Auth::user()->id;

        GeneralDiscount::create([
            'name' => $this->name,
            'discount_type_id' => $this->discount_type_id,
            'description' => $this->description ? $this->description : null,
            'amount' => $this->amount,
            'currency' => $this->currency ? $this->currency : 'AFN',
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
        $data = GeneralDiscount::findOrFail($id);
        $this->id = $data->id;
        $this->name = $data->name;
        $this->discount_type_id = $data->discount_type_id;
        $this->description = $data->description;
        $this->amount = $data->amount;
        $this->currency = $data->currency;
        $this->is_active = $data->is_active;

        $this->openModal();
    }

    public function update()
    {
        $this->validate([
            'name' => 'required',
            'discount_type_id' => 'required',
            'amount' => 'required|numeric',
            'is_active' => 'required|boolean',
        ]);

        $data = GeneralDiscount::findOrFail($this->id);

        $data->update([
            'name' => $this->name,
            'discount_type_id' => $this->discount_type_id,
            'description' => $this->description ? $this->description : null,
            'amount' => $this->amount,
            'currency' => $this->currency ? $this->currency : 'AFN',
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
        $data = GeneralDiscount::findOrFail($id);
        $data->update(['is_delete' => 1]);
        $this->dispatch('error', message: 'Record marked as deleted successfully.');
    }
}
