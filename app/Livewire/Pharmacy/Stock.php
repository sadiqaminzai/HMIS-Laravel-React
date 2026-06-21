<?php

namespace App\Livewire\Pharmacy;

use App\Models\Pharmacy\Product;
use App\Models\Pharmacy\Stock as PharmacyStock;
use Livewire\Component;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Livewire\WithFileUploads;
use Livewire\WithPagination;

class Stock extends Component
{
    use WithPagination;
    use WithFileUploads;

    public $id, $product_id, $batch_no, $mfg_date, $expiry_date, $quantity, $bonus, $unit_price, $discount, $amount, $created_by, $updated_by;

    public $search = ''; // Add a search variable
    public $isOpen = 0;
    public $selectedStock;

    protected $paginationTheme = 'bootstrap'; // To use Bootstrap for pagination

    public function showDetails($id)
    {
        $this->selectedStock = PharmacyStock::with(['product', 'user'])->findOrFail($id);
        $this->dispatch('open-modal', 'detailsModal');
    }

    public function closeDetailsModal()
    {
        $this->selectedStock = null;
        $this->dispatch('close-modal', 'detailsModal');
    }

    public function updatingSearch()
    {
        $this->resetPage(); // Reset pagination when search query is updated
    }

    public function render()
    {
        $products = Product::where('is_delete', 0)->where('is_active', 1)->get();

        // Add a search filter
        $stocksQuery = PharmacyStock::with(['product', 'user']);

        if ($this->search) {
            $stocksQuery->whereHas('product', function ($query) {
                $query->where('name', 'like', '%' . $this->search . '%'); // Search filter for product name
            })->orWhereHas('user', function ($query) {
                $query->where('name', 'like', '%' . $this->search . '%'); // Search filter for creator's name
            });
        }

        $stocks = $stocksQuery->orderBy('product_id')->get(); // Get all results without pagination

        return view('livewire.pharmacy.stock', ['stocks' => $stocks, 'products' => $products]);
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
        $this->product_id = '';
        $this->batch_no = '';
        $this->mfg_date = '';
        $this->expiry_date = '';
        $this->quantity = '';
        $this->bonus = '';
        $this->unit_price = '';
        $this->discount = '';
        $this->amount = '';
    }

    // Methods to fetch unit price and calculate amount
    public function fetchProductDetails()
    {
        if ($this->product_id) {
            $product = Product::find($this->product_id);
            if ($product) {
                $this->unit_price = $product->cost_price;
                // Calculate amount if quantity is already set
                $this->calculateAmount();
            }
        }
    }


    public function updatedQuantityInStock($value)
    {
        $this->calculateAmount();
    }

    public function calculateAmount()
    {
        $this->amount = (float) $this->quantity * (float) $this->unit_price;
    }

    public function add()
    {
        $this->validate([
            'product_id' => 'required',
            'batch_no' => 'required',
            'mfg_date' => 'required|date',
            'expiry_date' => 'required|date',
            'quantity' => 'required|integer',
            'unit_price' => 'required|numeric',
            'amount' => 'required|numeric',
        ]);

        PharmacyStock::create([
            'product_id' => $this->product_id,
            'batch_no' => $this->batch_no,
            'mfg_date' => $this->mfg_date,
            'expiry_date' => $this->expiry_date,
            'quantity' => $this->quantity,
            'bonus' => $this->bonus ? $this->bonus : null,
            'unit_price' => $this->unit_price ? $this->unit_price : null,
            'discount' => $this->discount ? $this->discount : null,
            'amount' => $this->amount ? $this->amount : null,
            'created_by' => Auth::user()->id,
        ]);

        $this->resetInputFields();
        $this->dispatch('close-modal');
        $this->dispatch('save-modal');
        $this->dispatch('success', message: 'Record created successfully.');
    }

    public function edit($id)
    {
        $data = PharmacyStock::findOrFail($id);
        $this->id = $data->id;
        $this->product_id = $data->product_id;
        $this->batch_no = $data->batch_no;
        $this->mfg_date = $data->mfg_date;
        $this->expiry_date = $data->expiry_date;
        $this->quantity = $data->quantity;
        $this->bonus = $data->bonus;
        $this->unit_price = $data->unit_price;
        $this->discount = $data->discount;
        $this->amount = $data->amount;
        $this->created_by = $data->created_by;
        $this->updated_by = $data->updated_by;

        $this->openModal();
    }

    public function update()
    {
        $this->validate([
            'product_id' => 'required',
            'batch_no' => 'nullable',
            'mfg_date' => 'nullable|date',
            'expiry_date' => 'required|date',
            'quantity' => 'required|integer',
            'unit_price' => 'nullable|numeric',
            'amount' => 'nullable|numeric',
        ]);

        $data = PharmacyStock::findOrFail($this->id);

        $data->update([
            'product_id' => $this->product_id,
            'batch_no' => $this->batch_no ? $this->batch_no : null,
            'mfg_date' => $this->mfg_date ? $this->mfg_date : null,
            'expiry_date' => $this->expiry_date,
            'quantity' => $this->quantity,
            'bonus' => $this->bonus ? $this->bonus : null,
            'unit_price' => $this->unit_price ? $this->unit_price : null,
            'discount' => $this->discount ? $this->discount : null,
            'amount' => $this->amount ? $this->amount : null,
            'updated_by' => Auth::user()->id,
        ]);

        $this->resetInputFields();
        $this->dispatch('close-modal');
        $this->dispatch('save-modal');
        $this->dispatch('success', message: 'Record updated successfully.');
    }

    // Must be deleted permanently
    public function delete($id)
    {
        $data = PharmacyStock::findOrFail($id);
        $data->update(['is_delete' => 1]);
        $data->update(['deleted_by' => Auth::user()->id]);
        $this->dispatch('error', message: 'Record marked as deleted successfully.');
    }
}
