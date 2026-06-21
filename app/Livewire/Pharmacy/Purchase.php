<?php

namespace App\Livewire\Pharmacy;

use App\Models\Pharmacy\Product;
use App\Models\Pharmacy\Purchase as PharmacyPurchase;
use App\Models\Pharmacy\PurchaseDetail;
use App\Models\Pharmacy\Stock;
use App\Models\Pharmacy\StockSummary;
use App\Models\Pharmacy\Supplier;
use Illuminate\Contracts\Support\DeferringDisplayableValue;
use Illuminate\Support\Facades\DB;
use Livewire\Component;
use Illuminate\Support\Facades\Auth;
use Livewire\WithFileUploads;
use Livewire\WithPagination;

class Purchase extends Component
{
    use WithFileUploads, WithPagination;
    //for supplier
    public $supplier_phone, $supplier_address;

    public $showCurrentData = [];
    public $showEditData = [];
    public $showSearchData = [];

    public $suppliers; // for supplier dropdown
    public $products; // for product dropdown
    public $latestPurchase; // for showing the latest purchase as DEFAULT
    public $currentIndex = 0; // for next and previous buttons
    public $purchaseIds = []; // for next and previous buttons

    public $previewData = []; // for Preview button
    public $showModal = false; // New property to control modal visibility


    //for purchase
    public $id, $supplier_id, $purchase_no, $purchase_date, $bilty_no, $invoice_no, $is_active, $created_by;
    //for purchase detail
    public $purchase_id, $product_id, $batch_no, $mfg_date, $expiry_date, $quantity, $bonus_quantity, $unit_price, $discount, $amount;
    //for total calculation
    public $purchaseDetails = [
        ['product_code' => '', 'product_name' => '', 'unit_price' => '', 'batch_no' => '', 'mfg_date' => '', 'expiry' => '', 'quantity' => '', 'bonus' => '', 'discount' => '', 'amount' => '']
    ];
    public $total_quantity = 0;
    public $total_amount = 0.00;
    public $total_discount = 0.00;
    public $net_amount = 0.00;
    public $paid_amount = 0.00;
    public $due_amount = 0.00;
    public $isEditing = false;
    public $isStoring = false;
    public $isUpdating = false;

    public function enableEditing()
    {
        $this->isEditing = true;
        $this->purchase_date = now()->format('Y-m-d');
    }

    public function disableEditing()
    {
        $this->isEditing = false;
    }

    //for Stackholder details
    public function fetchStackholderDetails()
    {
        if (isset($this->supplier_id)) {
            $supplier = Supplier::find($this->supplier_id);

            if ($supplier) {
                $this->supplier_phone = $supplier->phone;
                $this->supplier_address = $supplier->address;
            } else {
                $this->supplier_phone = '';
                $this->supplier_address = '';
            }
        }
    }

    // This method will be called when the component is being mounted for the first time and it will set the initial values for the purchase_no and date properties.
    public function mount()
    {
        $this->suppliers = Supplier::where('is_delete', 0)->where('is_active', 1)->get();
        $this->products = Product::where('is_delete', 0)->where('is_active', 1)->get();
        $this->fetchLatestPurchase(); // for showing the latest purchase as DEFAULT
        $this->fetchPurchaseIds(); // for next and previous buttons
    }

    public function fetchProductDetails($index)
    {
        if (isset($this->purchaseDetails[$index]['product_id'])) {
            $productId = $this->purchaseDetails[$index]['product_id'];
            $product = Product::find($productId);

            if ($product) {
                $this->purchaseDetails[$index]['product_name'] = $product->name;
                $this->purchaseDetails[$index]['unit_price'] = $product->cost_price;
            } else {
                $this->purchaseDetails[$index]['product_name'] = '';
                $this->purchaseDetails[$index]['unit_price'] = '';
            }
        }
    }

    public function fetchCurrentData()
    {
        // Show Current Data
        $this->showCurrentData = [
            'supplier_name' => $this->suppliers->where('id', $this->supplier_id)->first()->name ?? 'N/A',
            'invoice_no' => $this->invoice_no,
            'bilty_no' => $this->bilty_no,
            'purchase_no' => $this->purchase_no,
            'purchase_date' => $this->purchase_date,
            'currency' => 'AFN',
            'total_quantity' => $this->total_quantity,
            'total_amount' => $this->total_amount,
            'total_discount' => $this->total_discount,
            'net_amount' => $this->net_amount,
            'paid_amount' => $this->paid_amount,
            'due_amount' => $this->due_amount,
            'purchaseDetails' => collect($this->purchaseDetails)->map(function ($detail) {
                return [
                    'quantity' => $detail['quantity'] ?? 0,
                    'bonus_quantity' => $detail['bonus_quantity'] ?? 0,
                    'product_name' => $detail['product_name'] ?? 'N/A',
                    'product_name' => Product::find($detail['product_id'])->name ?? 'N/A',
                    'batch_no' => $detail['batch_no'] ?? '',
                    'expiry_date' => $detail['expiry_date'] ?? '',
                    'unit_price' => $detail['unit_price'] ?? 0,
                    'discount' => $detail['discount'] ?? 0,
                    'amount' => $detail['amount'] ?? 0,
                ];
            })->toArray(),
        ];
    }

    public function fetchSelectedData($purchaseNo)
    {
        // Find the purchase details for the selected purchase number
        $purchase = PharmacyPurchase::where('purchase_no', $purchaseNo)
            ->with('supplier', 'purchaseDetails')
            ->first();
    
        // Check if purchase exists, then populate the relevant properties
        if ($purchase) {
            $this->supplier_id = $purchase->supplier_id;
            $this->purchase_no = $purchase->purchase_no;
            $this->purchase_date = $purchase->purchase_date;
            $this->supplier_phone = $purchase->supplier->phone ?? 'N/A';
            $this->supplier_address = $purchase->supplier->address ?? 'N/A';
            $this->bilty_no = $purchase->bilty_no;
            $this->invoice_no = $purchase->invoice_no;
            $this->total_quantity = $purchase->total_quantity;
            $this->total_discount = $purchase->total_discount;
            $this->total_amount = $purchase->total_amount;
            $this->net_amount = $purchase->net_amount;
            $this->paid_amount = $purchase->paid_amount;
            $this->due_amount = $purchase->due_amount;
    
            // Populate purchase details
            $this->purchaseDetails = collect($purchase->purchaseDetails)->map(function ($detail) {
                return [
                    'product_id' => $detail->product_id,
                    'product_name' => Product::find($detail->product_id)->name ?? 'N/A',
                    'batch_no' => $detail->batch_no,
                    'mfg_date' => $detail->mfg_date,
                    'expiry_date' => $detail->expiry_date,
                    'quantity' => $detail->quantity,
                    'bonus_quantity' => $detail->bonus_quantity,
                    'unit_price' => $detail->unit_price,
                    'discount' => $detail->discount,
                    'amount' => $detail->amount,
                ];
            })->toArray();
            $this->dispatch('close-modal');
    
        }
    
    }
    

    public function fetchLatestPurchase()
    {
        $this->latestPurchase = PharmacyPurchase::where('is_delete', 0)->where('is_active', 1)
            ->latest()
            ->with('supplier', 'purchaseDetails')
            ->first();

        if ($this->latestPurchase) {
            $this->supplier_id = $this->latestPurchase->supplier_id;
            $this->purchase_no = $this->latestPurchase->purchase_no;
            $this->purchase_date = $this->latestPurchase->purchase_date;
            $this->supplier_phone = $this->latestPurchase->supplier->phone ?? '';
            $this->supplier_address = $this->latestPurchase->supplier->address ?? '';
            $this->bilty_no = $this->latestPurchase->bilty_no;
            $this->invoice_no = $this->latestPurchase->invoice_no;
            $this->total_quantity = $this->latestPurchase->total_quantity;
            $this->total_discount = $this->latestPurchase->total_discount;
            $this->total_amount = $this->latestPurchase->total_amount;
            $this->net_amount = $this->latestPurchase->net_amount;
            $this->paid_amount = $this->latestPurchase->paid_amount;
            $this->due_amount = $this->latestPurchase->due_amount;
            $this->purchaseDetails = $this->latestPurchase->purchaseDetails->toArray();
        }
    }

    public function calculateTotals()
    {
        $this->total_quantity = 0;
        $this->total_amount = 0.00;
        $this->total_discount = 0.00;

        foreach ($this->purchaseDetails as $detail) {
            $quantity = (float) ($detail['quantity'] ?? 0);
            $salePrice = (float) ($detail['unit_price'] ?? 0);
            $discountPercentage = (float) ($detail['discount'] ?? 0);

            $this->total_quantity += $quantity;
            $this->total_amount += $quantity * $salePrice;
            $this->total_discount += ($quantity * $salePrice) * ($discountPercentage / 100);
        }

        $this->net_amount = $this->total_amount - $this->total_discount;
        $this->due_amount = $this->net_amount - $this->paid_amount;
    }

    public function calculateItemAmount($index)
    {
        $quantity = (float) ($this->purchaseDetails[$index]['quantity'] ?? 0);
        $salePrice = (float) ($this->purchaseDetails[$index]['unit_price'] ?? 0);
        $discountPercentage = (float) ($this->purchaseDetails[$index]['discount'] ?? 0);

        $discountAmount = ($quantity * $salePrice) * ($discountPercentage / 100);
        $this->purchaseDetails[$index]['amount'] = ($quantity * $salePrice) - $discountAmount;
        $this->calculateTotals();
    }

    public function calculateDueAmount()
    {
        $this->due_amount = $this->net_amount - $this->paid_amount;
    }

    public function updated($propertyName)
    {
        if (strpos($propertyName, 'purchaseDetails') !== false) {
            $this->calculateTotals();
        } elseif ($propertyName === 'paid_amount') {
            $this->calculateDueAmount();
        }
    }

    public function addItem()
    {
        $this->purchaseDetails[] = [
            'product_id' => '',
            'product_name' => '',
            'unit_price' => '',
            'batch_no' => '',
            'mfg_date' => '',
            'expiry' => '',
            'quantity' => '',
            'bonus_quantity' => '',
            'discount' => '',
            'amount' => ''
        ];
    }

    public function removePurchaseDetail($index)
    {
        unset($this->purchaseDetails[$index]);
        $this->purchaseDetails = array_values($this->purchaseDetails); // Reindex the array
        $this->calculateTotals(); // Recalculate totals
    }

    public function render()
    {
        $suppliers = Supplier::where('is_delete', 0)->where('is_active', 1)->get();
        $products = Product::where('is_delete', 0)->where('is_active', 1)->get();
        $purchases = PharmacyPurchase::where('is_delete', 0)->where('is_active', 1)
            ->with('supplier', 'purchaseDetails', 'user')
            ->latest()
            ->get();

        return view('livewire.pharmacy.purchase', [
            'purchases' => $purchases,
            'suppliers' => $suppliers,
            'products' => $products,
        ]);
    }

    public $isChangesEnabled = false;

    public function isChangesEnabled()
    {
        return $this->purchase_id ? false : true;
    }

    private function resetInputFields()
    {
        $purchases = PharmacyPurchase::where('is_active', 1)
            ->with('supplier', 'purchaseDetails', 'user')
            ->latest()
            ->get();
        $this->id = null;
        $this->supplier_id = null;
        $this->supplier_phone = null;
        $this->supplier_address = null;
        $this->purchase_no = $purchases->max('purchase_no') + 1;
        $this->bilty_no = null;
        $this->invoice_no = null;
        $this->total_amount = null;
        $this->total_discount = null;
        $this->total_quantity = null;
        $this->net_amount = null;
        $this->paid_amount = null;
        $this->due_amount = null;
        $this->purchaseDetails = [
            ['product_id' => '', 'product_name' => '', 'unit_price' => '', 'batch_no' => '', 'mfg_date' => '', 'expiry' => '', 'quantity' => '', 'bonus' => '', 'discount' => '', 'amount' => '']
        ];
    }

    public function new()
    {
        $this->resetInputFields();
        $this->isChangesEnabled = true;
        $this->isStoring = true;
        $this->enableEditing();
    }

    //cancel the entry and reset the fields
    public function cancel_store()
    {
        $this->isChangesEnabled = false;
        $this->isStoring = false;
        $this->isUpdating = false;
        $this->fetchLatestPurchase();
        $this->disableEditing();
    }

    //cancel the entry and reset the fields
    public function cancel_update()
    {
        $this->isChangesEnabled = false;
        $this->isStoring = false;
        $this->isUpdating = false;
        $this->fetchCurrentData();
        $this->disableEditing();
    }

    public function store()
    {
        // Validate the input data
        $this->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'purchase_date' => 'required|date',
            'purchaseDetails.*.product_id' => 'required|exists:products,id',
            'purchaseDetails.*.unit_price' => 'required|numeric',
            'purchaseDetails.*.mfg_date' => 'required|date',
            'purchaseDetails.*.expiry_date' => 'required|date',
            'purchaseDetails.*.quantity' => 'required|integer|min:1',
            'purchaseDetails.*.discount' => 'nullable|numeric|min:0',
            'purchaseDetails.*.amount' => 'required|numeric|min:0',
        ]);

        $user_id = Auth::user()->id;

        // Storing General Purchase Information
        $purchase = PharmacyPurchase::create([
            'supplier_id' => $this->supplier_id,
            'purchase_no' => $this->purchase_no,
            'purchase_date' => $this->purchase_date,
            'bilty_no' => $this->bilty_no ?? null,
            'invoice_no' => $this->invoice_no ?? null,
            'total_amount' => $this->total_amount,
            'total_discount' => $this->total_discount,
            'total_quantity' => $this->total_quantity,
            'net_amount' => $this->net_amount,
            'paid_amount' => $this->paid_amount,
            'due_amount' => $this->due_amount,
            'created_by' => $user_id,
        ]);

        // Iterate over the purchaseDetails array and save each detail
        foreach ($this->purchaseDetails as $detail) {
            PurchaseDetail::create([
                'purchase_id' => $purchase->id,
                'product_id' => $detail['product_id'],
                'unit_price' => $detail['unit_price'],
                'batch_no' => isset($detail['batch_no']) && $detail['batch_no'] !== '' ? $detail['batch_no'] : null,
                'mfg_date' => $detail['mfg_date'],
                'expiry_date' => $detail['expiry_date'],
                'quantity' => $detail['quantity'],
                'bonus_quantity' => isset($detail['bonus_quantity']) && $detail['bonus_quantity'] !== '' ? (int)$detail['bonus_quantity'] : 0,
                'discount' => isset($detail['discount']) && $detail['discount'] !== '' ? (float)$detail['discount'] : 0,
                'amount' => $detail['amount'],
                'created_by' => $user_id,
            ]);

            // Check if the product_id and batch_no already exist in the Stock table
            $stock = Stock::where('product_id', $detail['product_id'])
                ->where('batch_no', $detail['batch_no'])
                ->first();

            if ($stock) {
                // If the product_id and batch_no exist, update the existing record
                $stock->update([
                    'quantity' => $stock->quantity + $detail['quantity'],
                    'bonus' => $stock->bonus + (isset($detail['bonus_quantity']) && $detail['bonus_quantity'] !== '' ? (int)$detail['bonus_quantity'] : 0),
                    'discount' => $stock->discount + (isset($detail['discount']) && $detail['discount'] !== '' ? (float)$detail['discount'] : 0),
                    'amount' => $stock->amount + $detail['amount'],
                    'updated_by' => $user_id,
                ]);
            } else {
                // If the product_id exists but batch_no is different or product_id does not exist, insert a new record
                Stock::create([
                    'product_id' => $detail['product_id'],
                    'unit_price' => $detail['unit_price'],
                    'batch_no' => isset($detail['batch_no']) && $detail['batch_no'] !== '' ? $detail['batch_no'] : null,
                    'mfg_date' => $detail['mfg_date'],
                    'expiry_date' => $detail['expiry_date'],
                    'quantity' => $detail['quantity'],
                    'bonus' => isset($detail['bonus_quantity']) && $detail['bonus_quantity'] !== '' ? (int)$detail['bonus_quantity'] : 0,
                    'discount' => isset($detail['discount']) && $detail['discount'] !== '' ? (float)$detail['discount'] : 0,
                    'amount' => $detail['amount'],
                    'transaction_id' => $purchase->id,
                    'transaction_type' => 'purchase',
                    'created_by' => $user_id,
                ]);
            }

            //CREATE STOCK SUMMARY RECORD (STORING THE SUMMARY OF STOCK)
            // Check if a stock summary record already exists for the product_id
            $latestStockSummary = StockSummary::where('product_id', $detail['product_id'])
                ->orderBy('created_at', 'desc')
                ->first();

            if ($latestStockSummary) {
                // Use the latest closing_quantity as the opening_quantity for the new record
                $openingQuantity = $latestStockSummary->closing_quantity;
            } else {
                // If no record exists, set opening_quantity to 0
                $openingQuantity = 0;
            }

            // Ensure quantity and bonus_quantity are integers
            $quantity = (int) $detail['quantity'];
            $bonusQuantity = isset($detail['bonus_quantity']) ? (int) $detail['bonus_quantity'] : 0;

            // Calculate the closing quantities and amounts
            $closingQuantity = $openingQuantity + $quantity + $bonusQuantity;
            $closingAmount = $closingQuantity * $detail['unit_price'];

            // Create a new stock summary record
            StockSummary::create([
                'product_id' => $detail['product_id'],
                'opening_quantity' => $openingQuantity,
                'purchase_quantity' => $quantity + $bonusQuantity,
                'closing_quantity' => $closingQuantity,
                'closing_amount' => $closingAmount,
                'transaction_id' => $purchase->id,
                'transaction_type' => 'purchase',
                'created_by' => $user_id,
            ]);
        }

        $this->disableEditing();
        $this->isChangesEnabled = false;
        $this->isStoring = false;
        $this->fetchCurrentData();
        $this->dispatch('success', message: 'Purchase details saved successfully.');
    }

    public function edit()
    {
        $this->disableEditing();
        $this->isChangesEnabled = true;
        $this->isUpdating = true;
        $this->enableEditing();

        // Show Edit Data
        $this->showEditData = [
            'supplier_name' => $this->suppliers->where('id', $this->supplier_id)->first()->name ?? 'N/A',
            'invoice_no' => $this->invoice_no,
            'bilty_no' => $this->bilty_no,
            'purchase_no' => $this->purchase_no,
            'purchase_date' => $this->purchase_date,
            'currency' => 'AFN',
            'total_quantity' => $this->total_quantity,
            'total_amount' => $this->total_amount,
            'total_discount' => $this->total_discount,
            'net_amount' => $this->net_amount,
            'paid_amount' => $this->paid_amount,
            'due_amount' => $this->due_amount,
            'purchaseDetails' => collect($this->purchaseDetails)->map(function ($detail) {
                return [
                    'quantity' => $detail['quantity'] ?? 0,
                    'bonus_quantity' => $detail['bonus_quantity'] ?? 0,
                    'product_name' => $detail['product_name'] ?? 'N/A',
                    'product_name' => Product::find($detail['product_id'])->name ?? 'N/A',
                    'batch_no' => $detail['batch_no'] ?? '',
                    'expiry_date' => $detail['expiry_date'] ?? '',
                    'unit_price' => $detail['unit_price'] ?? 0,
                    'discount' => $detail['discount'] ?? 0,
                    'amount' => $detail['amount'] ?? 0,
                ];
            })->toArray(),
        ];
    }

    public function update()
    {
        $this->validate([
            'supplier_id' => 'required|exists:suppliers,id',
            'purchase_date' => 'required|date',
            'purchaseDetails.*.product_id' => 'required|exists:products,id',
            'purchaseDetails.*.unit_price' => 'required|numeric',
            'purchaseDetails.*.mfg_date' => 'required|date',
            'purchaseDetails.*.expiry_date' => 'required|date',
            'purchaseDetails.*.quantity' => 'required|integer|min:1',
            'purchaseDetails.*.discount' => 'nullable|numeric|min:0',
            'purchaseDetails.*.amount' => 'required|numeric|min:0',
        ]);

        $user_id = Auth::user()->id;

        // Update the data in purchases table
        $data = PharmacyPurchase::where('purchase_no', $this->purchase_no)->first();
        $data->update([
            'supplier_id' => $this->supplier_id,
            'purchase_date' => $this->purchase_date,
            'bilty_no' => $this->bilty_no ?? null,
            'invoice_no' => $this->invoice_no ?? null,
            'total_amount' => $this->total_amount,
            'total_discount' => $this->total_discount,
            'total_quantity' => $this->total_quantity,
            'net_amount' => $this->net_amount,
            'paid_amount' => $this->paid_amount,
            'due_amount' => $this->due_amount,
            'updated_by' => $user_id,
        ]);

        // Iterate over the purchaseDetails array and save each detail
        foreach ($this->purchaseDetails as $detail) {
            $existingDetail = PurchaseDetail::where('purchase_id', $data->id)
                ->where('product_id', $detail['product_id'])
                ->where('batch_no', $detail['batch_no'])
                ->first();

            $quantityDifference = $detail['quantity'];
            if ($existingDetail) {
                $quantityDifference = $detail['quantity'] - $existingDetail->quantity;
            }

            PurchaseDetail::updateOrCreate(
                [
                    'purchase_id' => $data->id,
                    'product_id' => $detail['product_id'],
                    'batch_no' => isset($detail['batch_no']) && $detail['batch_no'] !== '' ? $detail['batch_no'] : null,
                ],
                [
                    'unit_price' => $detail['unit_price'],
                    'mfg_date' => $detail['mfg_date'],
                    'expiry_date' => $detail['expiry_date'],
                    'quantity' => $detail['quantity'],
                    'bonus_quantity' => isset($detail['bonus_quantity']) && $detail['bonus_quantity'] !== '' ? (int)$detail['bonus_quantity'] : 0,
                    'discount' => isset($detail['discount']) && $detail['discount'] !== '' ? (float)$detail['discount'] : 0,
                    'amount' => $detail['amount'],
                    'updated_by' => $user_id,
                    'created_by' => $user_id,
                ]
            );

            // Check if the product_id and batch_no already exist in the Stock table
            $stock = Stock::where('product_id', $detail['product_id'])
                ->where('batch_no', $detail['batch_no'])
                ->first();

            if ($stock) {
                // If the product_id and batch_no exist, update the existing record
                $stock->update([
                    'quantity' => $stock->quantity + $quantityDifference,
                    'bonus' => $detail['bonus_quantity'] ?? 0,
                    'discount' => $detail['discount'] ?? 0,
                    'amount' => $detail['amount'],
                    'updated_by' => $user_id,
                ]);
            } else {
                // If the product_id exists but batch_no is different or product_id does not exist, insert a new record
                Stock::create([
                    'product_id' => $detail['product_id'],
                    'unit_price' => $detail['unit_price'],
                    'batch_no' => isset($detail['batch_no']) && $detail['batch_no'] !== '' ? $detail['batch_no'] : null,
                    'mfg_date' => $detail['mfg_date'],
                    'expiry_date' => $detail['expiry_date'],
                    'quantity' => $detail['quantity'],
                    'bonus' => isset($detail['bonus_quantity']) && $detail['bonus_quantity'] !== '' ? (int)$detail['bonus_quantity'] : 0,
                    'discount' => isset($detail['discount']) && $detail['discount'] !== '' ? (float)$detail['discount'] : 0,
                    'amount' => $detail['amount'],
                    'transaction_id' => $data->id,
                    'transaction_type' => 'purchase',
                    'created_by' => $user_id,
                ]);
            }

            //UPDATE STOCK SUMMARY RECORD (STORING THE SUMMARY OF STOCK)
            // Check if a stock summary record already exists for the product_id and purchase_id
            $stockSummary = StockSummary::where('product_id', $detail['product_id'])
                ->where('transaction_id', $data->id)
                ->where('transaction_type', 'purchase')
                ->first();

            if ($stockSummary) {
                // Ensure quantity and bonus_quantity are integers
                $quantity = (int) $detail['quantity'];
                $bonusQuantity = isset($detail['bonus_quantity']) ? (int) $detail['bonus_quantity'] : 0;

                // Update the existing stock summary record
                $stockSummary->update([
                    'purchase_quantity' => $quantity + $bonusQuantity,
                    'closing_quantity' => $stockSummary->opening_quantity + $quantity + $bonusQuantity,
                    'closing_amount' => ($stockSummary->opening_quantity + $quantity + $bonusQuantity) * $detail['unit_price'],
                    'updated_by' => $user_id,
                ]);

                // Update subsequent records
                $subsequentSummaries = StockSummary::where('product_id', $detail['product_id'])
                    ->where('transaction_id', '>', $data->id)
                    ->where('transaction_type', 'purchase')
                    ->orderBy('transaction_id', 'asc')
                    ->get();

                $previousClosingQuantity = $stockSummary->closing_quantity;
                foreach ($subsequentSummaries as $subsequentSummary) {
                    $subsequentSummary->update([
                        'opening_quantity' => $previousClosingQuantity,
                        'closing_quantity' => $previousClosingQuantity + $subsequentSummary->purchase_quantity,
                        'closing_amount' => ($previousClosingQuantity + $subsequentSummary->purchase_quantity) * $subsequentSummary->unit_price,
                        'updated_by' => $user_id,
                    ]);
                    $previousClosingQuantity = $subsequentSummary->closing_quantity;
                }
            } else {
                // Check if a stock summary record already exists for the product_id
                $latestStockSummary = StockSummary::where('product_id', $detail['product_id'])
                    ->where('transaction_id', '<', $data->id)
                    ->where('transaction_type', 'purchase')
                    ->orderBy('created_at', 'desc')
                    ->first();

                if ($latestStockSummary) {
                    // Use the latest closing_quantity as the opening_quantity for the new record
                    $openingQuantity = $latestStockSummary->closing_quantity;
                } else {
                    // If no record exists, set opening_quantity to 0
                    $openingQuantity = 0;
                }

                // Ensure quantity and bonus_quantity are integers
                $quantity = (int) $detail['quantity'];
                $bonusQuantity = isset($detail['bonus_quantity']) ? (int) $detail['bonus_quantity'] : 0;

                // Calculate the closing quantities and amounts
                $closingQuantity = $openingQuantity + $quantity + $bonusQuantity;
                $closingAmount = $closingQuantity * $detail['unit_price'];

                // Create a new stock summary record
                $newStockSummary = StockSummary::create([
                    'product_id' => $detail['product_id'],
                    'opening_quantity' => $openingQuantity,
                    'purchase_quantity' => $quantity + $bonusQuantity,
                    'closing_quantity' => $closingQuantity,
                    'closing_amount' => $closingAmount,
                    'transaction_id' => $data->id,
                    'transaction_type' => 'purchase',
                    'created_by' => $user_id,
                ]);

                // Update subsequent records
                $subsequentSummaries = StockSummary::where('product_id', $detail['product_id'])
                    ->where('transaction_id', '>', $data->id)
                    ->where('transaction_type', 'purchase')
                    ->orderBy('transaction_id', 'asc')
                    ->get();

                $previousClosingQuantity = $newStockSummary->closing_quantity;
                foreach ($subsequentSummaries as $subsequentSummary) {
                    $subsequentSummary->update([
                        'opening_quantity' => $previousClosingQuantity,
                        'closing_quantity' => $previousClosingQuantity + $subsequentSummary->purchase_quantity,
                        'closing_amount' => ($previousClosingQuantity + $subsequentSummary->purchase_quantity) * $subsequentSummary->unit_price,
                        'updated_by' => $user_id,
                    ]);
                    $previousClosingQuantity = $subsequentSummary->closing_quantity;
                }
            }
        }

        $this->disableEditing();
        $this->isChangesEnabled = false;
        $this->isUpdating = false;
        $this->fetchCurrentData();
        $this->dispatch('success', message: 'Record updated successfully.');
    }

    public function search()
    {
        $this->showSearchData = PharmacyPurchase::with('supplier')
            ->get(['purchase_no', 'purchase_date', 'supplier_id'])
            ->map(function ($purchase) {
                return [
                    'purchase_no' => $purchase->purchase_no,
                    'supplier_name' => $purchase->supplier->name ?? 'N/A',
                    'purchase_date' => $purchase->purchase_date,
                ];
            })
            ->toArray();
    }

    public function delete($id)
    {
        $user_id = Auth::user()->id;

        // Find the purchase record
        $data = PharmacyPurchase::with('purchaseDetails')->findOrFail($id);

        // Mark the purchase record as deleted
        $data->update([
            'is_delete' => 1,
            'deleted_by' => $user_id,
            'deleted_at' => now(),
        ]);

        // Mark the related purchase details as deleted
        foreach ($data->purchaseDetails as $detail) {
            $detail->update([
                'is_delete' => 1,
                'deleted_by' => $user_id,
                'deleted_at' => now(),
            ]);

            // Update the stock record
            $stock = Stock::where('product_id', $detail['product_id'])
                ->where('batch_no', $detail['batch_no'])
                ->first();

            if ($stock) {
                $stock->update([
                    'quantity' => $stock->quantity - $detail['quantity'],
                    'bonus' => $stock->bonus - (isset($detail['bonus_quantity']) ? $detail['bonus_quantity'] : 0),
                    'updated_by' => $user_id,
                ]);
            }

            // Update the stock summary record
            $stockSummary = StockSummary::where('product_id', $detail['product_id'])
                ->where('transaction_id', $data->id)
                ->where('transaction_type', 'purchase')
                ->first();

            if ($stockSummary) {
                $stockSummary->update([
                    'purchase_quantity' => 0,
                    'closing_quantity' => $stockSummary->opening_quantity,
                    'closing_amount' => $stockSummary->opening_quantity * $detail['unit_price'],
                    'updated_by' => $user_id,
                ]);

                // Update subsequent records
                $subsequentSummaries = StockSummary::where('product_id', $detail['product_id'])
                    ->where('transaction_id', '>', $data->id)
                    ->where('transaction_type', 'purchase')
                    ->orderBy('transaction_id', 'asc')
                    ->get();

                $previousClosingQuantity = $stockSummary->opening_quantity;
                foreach ($subsequentSummaries as $subsequentSummary) {
                    $subsequentSummary->update([
                        'opening_quantity' => $previousClosingQuantity,
                        'closing_quantity' => $previousClosingQuantity + $subsequentSummary->purchase_quantity,
                        'closing_amount' => ($previousClosingQuantity + $subsequentSummary->purchase_quantity) * $subsequentSummary->unit_price,
                        'updated_by' => $user_id,
                    ]);
                    $previousClosingQuantity = $subsequentSummary->closing_quantity;
                }
            }
        }

        $this->disableEditing();
        $this->isChangesEnabled = false;
        $this->fetchLatestPurchase();
        $this->dispatch('success', message: 'Record deleted successfully.');
    }

    // for next and previous buttons
    public function fetchPurchaseIds()
    {
        $this->purchaseIds = PharmacyPurchase::where('is_active', 1)
            ->where('is_delete', 0)
            ->orderBy('id', 'asc')
            ->pluck('id')
            ->toArray();
    }

    public function previous()
    {
        while ($this->currentIndex > 0) {
            $this->currentIndex--;
            $id = $this->purchaseIds[$this->currentIndex];
            $data = PharmacyPurchase::find($id);
            if ($data && $data->is_delete == 0) {
                $this->loadPurchase($id);
                break;
            }
        }
    }

    public function next()
    {
        while ($this->currentIndex < count($this->purchaseIds) - 1) {
            $this->currentIndex++;
            $id = $this->purchaseIds[$this->currentIndex];
            $data = PharmacyPurchase::find($id);
            if ($data && $data->is_delete == 0) {
                $this->loadPurchase($id);
                break;
            }
        }
    }


    public function loadPurchase($id)
    {
        $data = PharmacyPurchase::with('purchaseDetails')->findOrFail($id);
        $this->purchase_no = $data->purchase_no;

        if ($data->is_delete == 1) {
            // Clear other fields if the record is marked as deleted
            $this->supplier_id = null;
            $this->purchase_date = null;
            $this->bilty_no = null;
            $this->invoice_no = null;
            $this->total_amount = null;
            $this->total_discount = null;
            $this->total_quantity = null;
            $this->net_amount = null;
            $this->paid_amount = null;
            $this->due_amount = null;
            $this->purchaseDetails = [];
        } else {
            $this->id = $id;
            $this->supplier_id = $data->supplier_id;
            $this->purchase_date = $data->purchase_date;
            $this->bilty_no = $data->bilty_no;
            $this->invoice_no = $data->invoice_no;
            $this->total_amount = $data->total_amount;
            $this->total_discount = $data->total_discount;
            $this->total_quantity = $data->total_quantity;
            $this->net_amount = $data->net_amount;
            $this->paid_amount = $data->paid_amount;
            $this->due_amount = $data->due_amount;

            // Clear existing purchase details
            $this->purchaseDetails = [];

            // Set purchase details
            foreach ($data->purchaseDetails as $detail) {
                $this->purchaseDetails[] = [
                    'purchase_no' => $detail->purchase_no,
                    'product_id' => $detail->product_id,
                    'batch_no' => $detail->batch_no,
                    'mfg_date' => $detail->mfg_date,
                    'expiry_date' => $detail->expiry_date,
                    'quantity' => $detail->quantity,
                    'bonus_quantity' => $detail->bonus_quantity,
                    'unit_price' => $detail->unit_price,
                    'discount' => $detail->discount,
                    'amount' => $detail->amount,
                ];
            }
        }
    }

    public function preview()
    {
        $this->previewData = [
            'supplier_name' => $this->suppliers->where('id', $this->supplier_id)->first()->name ?? 'N/A',
            'invoice_no' => $this->invoice_no,
            'bilty_no' => $this->bilty_no,
            'purchase_no' => $this->purchase_no,
            'purchase_date' => $this->purchase_date,
            'currency' => 'AFN',
            'total_quantity' => $this->total_quantity,
            'total_amount' => $this->total_amount,
            'total_discount' => $this->total_discount,
            'net_amount' => $this->net_amount,
            'paid_amount' => $this->paid_amount,
            'due_amount' => $this->due_amount,
            'purchaseDetails' => collect($this->purchaseDetails)->map(function ($detail) {
                return [
                    'quantity' => $detail['quantity'] ?? 0,
                    'bonus_quantity' => $detail['bonus_quantity'] ?? 0,
                    'product_name' => $detail['product_name'] ?? 'N/A',
                    'product_name' => Product::find($detail['product_id'])->name ?? 'N/A',
                    'batch_no' => $detail['batch_no'] ?? '',
                    'mfg_date' => $detail['mfg_date'] ?? '',
                    'expiry_date' => $detail['expiry_date'] ?? '',
                    'unit_price' => $detail['unit_price'] ?? 0,
                    'discount' => $detail['discount'] ?? 0,
                    'amount' => $detail['amount'] ?? 0,
                ];
            })->toArray(),
        ];

        // Set showModal to true to open the modal
        $this->showModal = true;
    }

    public function closeModal()
    {
        $this->showModal = false; // Set showModal to false to close the modal
    }

    public function print()
    {
        // Logic for printing the purchase details
        // This could involve generating a printable view or redirecting to a print page
        $this->dispatch('print', ['purchase_no' => $this->purchase_no]);
    }

    public function exportToExcel()
    {
        // Logic for exporting the purchase details to Excel
        // This could involve generating an Excel file and returning it as a download
        $this->dispatch('exportToExcel', ['purchase_no' => $this->purchase_no]);
    }

    public function exportToPDF()
    {
        // Logic for exporting the purchase details to PDF
        // This could involve generating a PDF file and returning it as a download
        $this->dispatch('exportToPDF', ['purchase_no' => $this->purchase_no]);
    }
}
