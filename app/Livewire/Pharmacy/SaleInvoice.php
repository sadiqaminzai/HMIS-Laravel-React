<?php

namespace App\Livewire\Pharmacy;

use App\Models\Pharmacy\Product;
use App\Models\Pharmacy\SaleInvoice as PharmacySaleInvoice;
use App\Models\Pharmacy\SaleInvoiceDetail;
use App\Models\Pharmacy\Stock;
use App\Models\Pharmacy\StockSummary;
use App\Models\Reception\Patient;
use Illuminate\Contracts\Support\DeferringDisplayableValue;
use Illuminate\Support\Facades\DB;
use Livewire\Component;
use Illuminate\Support\Facades\Auth;
use Livewire\WithFileUploads;
use Livewire\WithPagination;

class SaleInvoice extends Component
{
    use WithFileUploads, WithPagination;
    //for patient
    public $age, $patient_address;

    // Product search related properties
    public $searchQuery = '';
    public $searchResults = [];
    public $showSearchResults = false;
    public $isSearching = false;

    public $showCurrentData = [];
    public $showEditData = [];
    public $showSearchData = [];

    public $patients; // for patient dropdown
    public $products; // for product dropdown
    public $latestSaleInvoice; // for showing the latest invoice as DEFAULT
    public $currentIndex = 0; // for next and previous buttons
    public $invoiceIds = []; // for next and previous buttons

    public $previewData = []; // for Preview button
    public $showModal = false; // New property to control modal visibility

    // for sale invoice:
    public $id, $patient_id, $doctor_id, $invoice_no, $invoice_date, $print_date, $discount_id, $discount_reason, $payment_status, $payment_method, $created_by, $updated_by, $deleted_by;
    public $total_quantity = 0;
    public $total_amount = 0.00;
    public $total_discount = 0.00;
    public $net_amount = 0.00;
    public $paid_amount = 0.00;
    public $due_amount = 0.00;

    //for sale invoice details:
    public $sale_invoice_id, $product_id, $batch_no, $mfg_date, $expiry_date, $quantity, $bonus_quantity, $unit_price, $discount, $amount, $is_active, $is_delete;

    //for saleinvoice total calculation
    public $saleInvoiceDetails = [
        ['product_code' => '', 'product_name' => '', 'unit_price' => '', 'batch_no' => '', 'mfg_date' => '', 'expiry_date' => '', 'quantity' => '', 'bonus' => '', 'discount' => '', 'amount' => '']
    ];


    public $isEditing = false;
    public $isStoring = false;
    public $isUpdating = false;

    public function enableEditing()
    {
        $this->isEditing = true;
        $this->invoice_date = now()->format('Y-m-d');
    }

    public function disableEditing()
    {
        $this->isEditing = false;
    }

    //for Stackholder details
    public function fetchStackholderDetails()
    {
        if (isset($this->patient_id)) {
            $patient = Patient::find($this->patient_id);

            if ($patient) {
                $this->age = $patient->age;
                $this->patient_address = $patient->address;
            } else {
                $this->age = '';
                $this->patient_address = '';
            }
        }
    }

    // This method will be called when the component is being mounted for the first time and it will set the initial values for the invoice_no and date properties.
    public function mount()
    {
        $this->patients = Patient::where('is_delete', 0)->where('is_active', 1)->orderBy('id', 'desc')->get();

        // Get products with available stock
        $this->products = Product::where('is_delete', 0)->where('is_active', 1)
            ->whereHas('stock', function ($query) {
                $query->where('quantity', '>=', 0);
            })
            ->get();

        // Get stock information batch-wise
        $this->products->each(function ($product) {
            $product->stock = $product->stock()
                ->where('quantity', '>', 0)
                ->orderBy('batch_no')
                ->get();
        });

        $this->fetchLatestSaleInvoice(); // for showing the latest invoice as DEFAULT
        $this->fetchInvoiceIds(); // for next and previous buttons
    }


    public function fetchProductDetails($index)
    {
        $productId = $this->saleInvoiceDetails[$index]['product_id'] ?? null;

        if (!$productId) {
            return;
        }

        // Check if the product is already added
        foreach ($this->saleInvoiceDetails as $key => $detail) {
            if ($key != $index && $detail['product_id'] == $productId) {
                $this->dispatch('error', 'This product is already added to the invoice.');
                $this->saleInvoiceDetails[$index]['product_id'] = null;
                return;
            }
        }

        $product = Product::find($productId);

        if ($product) {
            $this->saleInvoiceDetails[$index]['product_name'] = $product->name;
            $this->saleInvoiceDetails[$index]['unit_price'] = $product->sale_price;

            // Fetch the stock details for the product
            $stock = $product->stock()
                ->where('quantity', '>', 0)
                ->orderBy('batch_no')
                ->first();

            if ($stock) {
                $this->saleInvoiceDetails[$index]['batch_no'] = $stock->batch_no;
                $this->saleInvoiceDetails[$index]['mfg_date'] = $stock->mfg_date;
                $this->saleInvoiceDetails[$index]['expiry_date'] = $stock->expiry_date;
                $this->saleInvoiceDetails[$index]['stock_quantity'] = $stock->quantity;
            } else {
                $this->saleInvoiceDetails[$index]['batch_no'] = '';
                $this->saleInvoiceDetails[$index]['mfg_date'] = '';
                $this->saleInvoiceDetails[$index]['expiry_date'] = '';
                $this->saleInvoiceDetails[$index]['stock_quantity'] = '';
            }
        } else {
            $this->saleInvoiceDetails[$index]['product_name'] = '';
            $this->saleInvoiceDetails[$index]['unit_price'] = '';
            $this->saleInvoiceDetails[$index]['batch_no'] = '';
            $this->saleInvoiceDetails[$index]['mfg_date'] = '';
            $this->saleInvoiceDetails[$index]['expiry_date'] = '';
            $this->saleInvoiceDetails[$index]['stock_quantity'] = '';
        }
    }
            public function getSelectedProductIds()
        {
            return collect($this->saleInvoiceDetails)->pluck('product_id')->filter()->toArray();
        }


    public function fetchCurrentData()
    {
        // Show Current Data
        $this->showCurrentData = [
            'patient_name' => $this->patients->where('id', $this->patient_id)->first()->name ?? 'N/A',
            'invoice_no' => $this->invoice_no,
            'invoice_date' => $this->invoice_date,
            'currency' => 'AFN',
            'total_quantity' => $this->total_quantity,
            'total_amount' => $this->total_amount,
            'total_discount' => $this->total_discount,
            'net_amount' => $this->net_amount,
            'paid_amount' => $this->paid_amount,
            'due_amount' => $this->due_amount,
            'saleInvoiceDetails' => collect($this->saleInvoiceDetails)->map(function ($detail) {
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

    public function fetchSelectedData($invoiceNo)
    {
        // Find the invoice details for the selected invoice number
        $invoice = PharmacySaleInvoice::where('invoice_no', $invoiceNo)
            ->with('patient', 'saleInvoiceDetails')
            ->first();

        // Check if invoice exists, then populate the relevant properties
        if ($invoice) {
            $this->patient_id = $invoice->patient_id;
            $this->invoice_no = $invoice->invoice_no;
            $this->invoice_date = $invoice->invoice_date;
            $this->age = $invoice->patient->age ?? 'N/A';
            $this->patient_address = $invoice->patient->address ?? 'N/A';
            $this->total_quantity = $invoice->total_quantity;
            $this->total_discount = $invoice->total_discount;
            $this->total_amount = $invoice->total_amount;
            $this->net_amount = $invoice->net_amount;
            $this->paid_amount = $invoice->paid_amount;
            $this->due_amount = $invoice->due_amount;

            // Populate invoice details
            $this->saleInvoiceDetails = collect($invoice->saleInvoiceDetails)->map(function ($detail) {
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


    public function fetchLatestSaleInvoice()
    {
        $this->latestSaleInvoice = PharmacySaleInvoice::where('is_delete', 0)->where('is_active', 1)
            ->latest()
            ->with('patient', 'saleInvoiceDetails')
            ->first();

        if ($this->latestSaleInvoice) {
            $this->patient_id = $this->latestSaleInvoice->patient_id;
            $this->invoice_no = $this->latestSaleInvoice->invoice_no;
            $this->invoice_date = $this->latestSaleInvoice->invoice_date;
            $this->age = $this->latestSaleInvoice->patient->age ?? '';
            $this->patient_address = $this->latestSaleInvoice->patient->address ?? '';
            $this->total_quantity = $this->latestSaleInvoice->total_quantity;
            $this->total_discount = $this->latestSaleInvoice->total_discount;
            $this->total_amount = $this->latestSaleInvoice->total_amount;
            $this->net_amount = $this->latestSaleInvoice->net_amount;
            $this->paid_amount = $this->latestSaleInvoice->paid_amount;
            $this->due_amount = $this->latestSaleInvoice->due_amount;
            $this->saleInvoiceDetails = $this->latestSaleInvoice->saleInvoiceDetails->toArray();
        }
    }

    public function calculateTotals()
    {
        $this->total_quantity = 0;
        $this->total_amount = 0.00;
        $this->total_discount = 0.00;

        foreach ($this->saleInvoiceDetails as $detail) {
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
        $quantity = (float) ($this->saleInvoiceDetails[$index]['quantity'] ?? 0);
        $stockQuantity = (float) ($this->saleInvoiceDetails[$index]['stock_quantity'] ?? 0);

        // Ensure the entered quantity does not exceed available stock
        if ($quantity > $stockQuantity) {
            $this->dispatch('error', message: 'Quantity cannot exceed available stock.');
            $this->saleInvoiceDetails[$index]['quantity'] = $stockQuantity; // Reset to max available
            return;
        }

        $salePrice = (float) ($this->saleInvoiceDetails[$index]['unit_price'] ?? 0);
        $discountPercentage = (float) ($this->saleInvoiceDetails[$index]['discount'] ?? 0);

        $discountAmount = ($quantity * $salePrice) * ($discountPercentage / 100);
        $this->saleInvoiceDetails[$index]['amount'] = ($quantity * $salePrice) - $discountAmount;
        $this->calculateTotals();
    }



    public function calculateDueAmount()
    {
        $this->due_amount = $this->net_amount - $this->paid_amount;
    }

    public function updated($propertyName)
    {
        if (strpos($propertyName, 'saleInvoiceDetails') !== false) {
            $this->calculateTotals();
        } elseif ($propertyName === 'paid_amount') {
            $this->calculateDueAmount();
        }
    }

    public function addItem()
    {
        $this->saleInvoiceDetails[] = [
            'product_id' => '',
            'product_name' => '',
            'unit_price' => '',
            'batch_no' => '',
            'mfg_date' => '',
            'expiry_date' => '',
            'quantity' => '',
            'bonus_quantity' => '',
            'discount' => '',
            'amount' => ''
        ];
    }

    public function removeSaleInvoiceDetail($index)
    {
        unset($this->saleInvoiceDetails[$index]);
        $this->saleInvoiceDetails = array_values($this->saleInvoiceDetails); // Reindex the array
        $this->calculateTotals(); // Recalculate totals
    }

    public function render()
    {
        $patients = patient::where('is_delete', 0)->where('is_active', 1)->get();

        // Get products with available stock
        $products = Product::where('is_delete', 0)->where('is_active', 1)
            ->whereHas('stock', function ($query) {
                $query->where('quantity', '>=', 0);
            })
            ->get();

        // Get stock information batch-wise
        $products->each(function ($product) {
            $product->stock = $product->stock()
                ->where('quantity', '>=', 0)
                ->orderBy('batch_no')
                ->get();
        });

        $invoices = PharmacySaleInvoice::where('is_delete', 0)->where('is_active', 1)
            ->with('patient', 'saleInvoiceDetails', 'user')
            ->latest()
            ->get();

        return view('livewire.pharmacy.sale-invoice', [
            'invoices' => $invoices,
            'patients' => $patients,
            'products' => $products,
        ]);
    }

    public $isChangesEnabled = false;

    public function isChangesEnabled()
    {
        return $this->sale_invoice_id ? false : true;
    }

    private function resetInputFields()
    {
        $invoices = PharmacySaleInvoice::where('is_active', 1)
            ->with('patient', 'saleInvoiceDetails', 'user')
            ->latest()
            ->get();
        $this->id = null;
        $this->patient_id = null;
        $this->age = null;
        $this->patient_address = null;
        $this->invoice_no = $invoices->max('invoice_no') + 1;
        $this->total_amount = null;
        $this->total_discount = null;
        $this->total_quantity = null;
        $this->net_amount = null;
        $this->paid_amount = null;
        $this->due_amount = null;
        $this->saleInvoiceDetails = [
            ['product_id' => '', 'product_name' => '', 'unit_price' => '', 'batch_no' => '', 'mfg_date' => '', 'expiry_date' => '', 'quantity' => '', 'bonus' => '', 'discount' => '', 'amount' => '']
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
        $this->fetchLatestSaleInvoice();
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
            'patient_id' => 'required|exists:patients,id',
            'invoice_date' => 'required|date',
            'saleInvoiceDetails.*.product_id' => 'required|exists:products,id',
            'saleInvoiceDetails.*.unit_price' => 'required|numeric',
            'saleInvoiceDetails.*.mfg_date' => 'required|date',
            'saleInvoiceDetails.*.expiry_date' => 'required|date',
            'saleInvoiceDetails.*.quantity' => 'required|integer|min:1',
            'saleInvoiceDetails.*.discount' => 'nullable|numeric|min:0',
            'saleInvoiceDetails.*.amount' => 'required|numeric|min:0',
        ]);

        $user_id = Auth::user()->id;

        // Storing General invoice Information
        $invoice = PharmacySaleInvoice::create([
            'patient_id' => $this->patient_id,
            'invoice_no' => $this->invoice_no,
            'invoice_date' => $this->invoice_date,
            'total_amount' => $this->total_amount,
            'total_discount' => $this->total_discount,
            'total_quantity' => $this->total_quantity,
            'net_amount' => $this->net_amount,
            'paid_amount' => $this->paid_amount,
            'due_amount' => $this->due_amount,
            'created_by' => $user_id,
        ]);

        // Iterate over the saleInvoiceDetails array and save each detail
        foreach ($this->saleInvoiceDetails as $detail) {
            SaleInvoiceDetail::create([
                'sale_invoice_id' => $invoice->id,
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
                    'quantity' => $stock->quantity - $detail['quantity'],
                    'bonus' => $stock->bonus - (isset($detail['bonus_quantity']) && $detail['bonus_quantity'] !== '' ? (int)$detail['bonus_quantity'] : 0),
                    'discount' => $stock->discount - (isset($detail['discount']) && $detail['discount'] !== '' ? (float)$detail['discount'] : 0),
                    'amount' => $stock->amount - $detail['amount'],
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
                    'transaction_id' => $invoice->id,
                    'transaction_type' => 'sale_invoice',
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
            $closingQuantity = $openingQuantity - ($quantity - $bonusQuantity);
            $closingAmount = $closingQuantity * $detail['unit_price'];

            // Create a new stock summary record
            StockSummary::create([
                'product_id' => $detail['product_id'],
                'opening_quantity' => $openingQuantity,
                'sale_quantity' => $quantity - $bonusQuantity,
                'closing_quantity' => $closingQuantity,
                'closing_amount' => $closingAmount,
                'transaction_id' => $invoice->id,
                'transaction_type' => 'sale_invoice',
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

        // Re-populate product_name from product_id for display
        $this->showEditData = [
            'patient_name' => $this->patients->where('id', $this->patient_id)->first()->name ?? 'N/A',
            'invoice_no' => $this->invoice_no,
            'invoice_date' => $this->invoice_date,
            'currency' => 'AFN',
            'total_quantity' => $this->total_quantity,
            'total_amount' => $this->total_amount,
            'total_discount' => $this->total_discount,
            'net_amount' => $this->net_amount,
            'paid_amount' => $this->paid_amount,
            'due_amount' => $this->due_amount,
            'saleInvoiceDetails' => collect($this->saleInvoiceDetails)->map(function ($detail) {
                return [
                    'quantity' => $detail['quantity'] ?? 0,
                    'bonus_quantity' => $detail['bonus_quantity'] ?? 0,
                    'product_name' => isset($detail['product_id']) ? (Product::find($detail['product_id'])->name ?? 'N/A') : 'N/A',
                    'batch_no' => $detail['batch_no'] ?? '',
                    'expiry_date' => $detail['expiry_date'] ?? '',
                    'unit_price' => $detail['unit_price'] ?? 0,
                    'discount' => $detail['discount'] ?? 0,
                    'amount' => $detail['amount'] ?? 0,
                ];
            })->toArray(),
        ];

        // After loading the invoice details, re-fetch stock details for each product line
        foreach ($this->saleInvoiceDetails as $index => $detail) {
            if (!empty($detail['product_id'])) {
                $this->fetchProductDetails($index);
            }
        }
    }


    public function update()
    {
        $this->validate([
            'patient_id' => 'required|exists:patients,id',
            'invoice_date' => 'required|date',
            'saleInvoiceDetails.*.product_id' => 'required|exists:products,id',
            'saleInvoiceDetails.*.unit_price' => 'required|numeric',
            'saleInvoiceDetails.*.mfg_date' => 'required|date',
            'saleInvoiceDetails.*.expiry_date' => 'required|date',
            'saleInvoiceDetails.*.quantity' => 'required|integer|min:1',
            'saleInvoiceDetails.*.discount' => 'nullable|numeric|min:0',
            'saleInvoiceDetails.*.amount' => 'required|numeric|min:0',
        ]);

        $user_id = Auth::user()->id;

        // Update the data in invoices table
        $data = PharmacySaleInvoice::where('invoice_no', $this->invoice_no)->first();
        $data->update([
            'patient_id' => $this->patient_id,
            'invoice_date' => $this->invoice_date,
            'total_amount' => $this->total_amount,
            'total_discount' => $this->total_discount,
            'total_quantity' => $this->total_quantity,
            'net_amount' => $this->net_amount,
            'paid_amount' => $this->paid_amount,
            'due_amount' => $this->due_amount,
            'updated_by' => $user_id,
        ]);

        // Iterate over the saleInvoiceDetails array and save each detail
        foreach ($this->saleInvoiceDetails as $detail) {
            $existingDetail = SaleInvoiceDetail::where('sale_invoice_id', $data->id)
                ->where('product_id', $detail['product_id'])
                ->where('batch_no', $detail['batch_no'])
                ->first();

            $quantityDifference = $detail['quantity'];
            if ($existingDetail) {
                $quantityDifference = $detail['quantity'] - $existingDetail->quantity;
            }

            SaleInvoiceDetail::updateOrCreate(
                [
                    'sale_invoice_id' => $data->id,
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
                    'quantity' => $stock->quantity - $quantityDifference,
                    'bonus' => isset($detail['bonus_quantity']) && $detail['bonus_quantity'] !== '' ? (int)$detail['bonus_quantity'] : 0,
                    'discount' => isset($detail['discount']) && $detail['discount'] !== '' ? (float)$detail['discount'] : 0,
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
                    'transaction_type' => 'sale_invoice',
                    'created_by' => $user_id,
                ]);
            }

            // UPDATE STOCK SUMMARY RECORD (STORING THE SUMMARY OF STOCK)
            // Check if a stock summary record already exists for the product_id and sale_invoice_id
            $stockSummary = StockSummary::where('product_id', $detail['product_id'])
                ->where('transaction_id', $data->id)
                ->where('transaction_type', 'sale_invoice')
                ->first();

            if ($stockSummary) {
                // Ensure quantity and bonus_quantity are integers
                $newQuantity = (int)$detail['quantity'];
                $bonusQuantity = isset($detail['bonus_quantity']) ? (int)$detail['bonus_quantity'] : 0;

                // Update only the current stock summary record
                $stockSummary->update([
                    'sale_quantity' => $newQuantity - $bonusQuantity,
                    'closing_quantity' => $stockSummary->opening_quantity - ($newQuantity - $bonusQuantity),
                    'closing_amount' => ($stockSummary->opening_quantity - ($newQuantity - $bonusQuantity)) * $detail['unit_price'],
                    'updated_by' => $user_id,
                ]);

                // Update subsequent records only
                $subsequentSummaries = StockSummary::where('product_id', $detail['product_id'])
                    ->where('transaction_id', '>', $data->id)
                    ->orderBy('transaction_id', 'asc')
                    ->get();

                $previousClosingQuantity = $stockSummary->closing_quantity;
                foreach ($subsequentSummaries as $subsequentSummary) {
                    // Adjust opening and closing quantities for subsequent records
                    $newOpeningQuantity = $previousClosingQuantity;
                    $newClosingQuantity = $newOpeningQuantity - $subsequentSummary->sale_quantity;

                    $subsequentSummary->update([
                        'opening_quantity' => $newOpeningQuantity,
                        'closing_quantity' => $newClosingQuantity,
                        'closing_amount' => $newClosingQuantity * $subsequentSummary->unit_price,
                        'updated_by' => $user_id,
                    ]);

                    $previousClosingQuantity = $newClosingQuantity;
                }
            } else {
                // Get the latest closing_quantity for the product
                $latestStockSummary = StockSummary::where('product_id', $detail['product_id'])
                    ->orderBy('transaction_id', 'desc')
                    ->first();

                // Use the latest closing quantity as opening quantity for the new record
                $openingQuantity = $latestStockSummary ? $latestStockSummary->closing_quantity : 0;

                // Ensure quantity and bonus_quantity are integers
                $quantity = (int)$detail['quantity'];
                $bonusQuantity = isset($detail['bonus_quantity']) ? (int)$detail['bonus_quantity'] : 0;

                // Calculate the closing quantities and amounts for the new record
                $closingQuantity = $openingQuantity - ($quantity - $bonusQuantity);
                $closingAmount = $closingQuantity * $detail['unit_price'];

                // Create a new stock summary record for the new product
                $newStockSummary = StockSummary::create([
                    'product_id' => $detail['product_id'],
                    'opening_quantity' => $openingQuantity,
                    'sale_quantity' => $quantity - $bonusQuantity,
                    'closing_quantity' => $closingQuantity,
                    'closing_amount' => $closingAmount,
                    'transaction_id' => $data->id,
                    'transaction_type' => 'sale_invoice',
                    'created_by' => $user_id,
                ]);

                // Update subsequent records only
                $subsequentSummaries = StockSummary::where('product_id', $detail['product_id'])
                    ->where('transaction_id', '>', $data->id)
                    ->orderBy('transaction_id', 'asc')
                    ->get();

                $previousClosingQuantity = $newStockSummary->closing_quantity;
                foreach ($subsequentSummaries as $subsequentSummary) {
                    // Adjust opening and closing quantities for subsequent records
                    $newOpeningQuantity = $previousClosingQuantity;
                    $newClosingQuantity = $newOpeningQuantity - $subsequentSummary->sale_quantity;

                    $subsequentSummary->update([
                        'opening_quantity' => $newOpeningQuantity,
                        'closing_quantity' => $newClosingQuantity,
                        'closing_amount' => $newClosingQuantity * $subsequentSummary->unit_price,
                        'updated_by' => $user_id,
                    ]);

                    $previousClosingQuantity = $newClosingQuantity;
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
        $this->showSearchData = PharmacySaleInvoice::with('patient')
            ->get(['invoice_no', 'invoice_date', 'patient_id'])
            ->map(function ($invoice) {
                return [
                    'invoice_no' => $invoice->invoice_no,
                    'patient_name' => $invoice->patient->name ?? 'N/A',
                    'invoice_date' => $invoice->invoice_date,
                ];
            })
            ->toArray();
    }

    public function delete($id)
    {
        $user_id = Auth::user()->id;

        // Find the invoice record
        $data = PharmacySaleInvoice::with('saleInvoiceDetails')->findOrFail($id);

        // Mark the invoice record as deleted
        $data->update([
            'is_delete' => 1,
            'deleted_by' => $user_id,
            'deleted_at' => now(),
        ]);

        // Mark the related invoice details as deleted
        foreach ($data->saleInvoiceDetails as $detail) {
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
                    'quantity' => $stock->quantity + $detail['quantity'],
                    'bonus' => $stock->bonus + (isset($detail['bonus_quantity']) ? $detail['bonus_quantity'] : 0),
                    'updated_by' => $user_id,
                ]);
            }

            // Update the stock summary record
            $stockSummary = StockSummary::where('product_id', $detail['product_id'])
                ->where('transaction_id', $data->id)
                ->where('transaction_type', 'sale_invoice')
                ->first();

            if ($stockSummary) {
                $stockSummary->update([
                    'sale_quantity' => 0,
                    'closing_quantity' => $stockSummary->opening_quantity,
                    'closing_amount' => $stockSummary->opening_quantity * $detail['unit_price'],
                    'updated_by' => $user_id,
                ]);

                // Update subsequent records
                $subsequentSummaries = StockSummary::where('product_id', $detail['product_id'])
                    ->where('transaction_id', '>', $data->id)
                    ->where('transaction_type', 'sale_invoice')
                    ->orderBy('transaction_id', 'asc')
                    ->get();

                $previousClosingQuantity = $stockSummary->opening_quantity;
                foreach ($subsequentSummaries as $subsequentSummary) {
                    $subsequentSummary->update([
                        'opening_quantity' => $previousClosingQuantity,
                        'closing_quantity' => $previousClosingQuantity - $subsequentSummary->sale_quantity,
                        'closing_amount' => ($previousClosingQuantity - $subsequentSummary->sale_quantity) * $subsequentSummary->unit_price,
                        'updated_by' => $user_id,
                    ]);
                    $previousClosingQuantity = $subsequentSummary->closing_quantity;
                }
            }
        }

        $this->disableEditing();
        $this->isChangesEnabled = false;
        $this->fetchLatestSaleInvoice();
        $this->dispatch('success', message: 'Record deleted successfully.');
    }

    // for next and previous buttons
    public function fetchInvoiceIds()
    {
        $this->invoiceIds = PharmacySaleInvoice::where('is_active', 1)
            ->where('is_delete', 0)
            ->orderBy('id', 'asc')
            ->pluck('id')
            ->toArray();
    }

    public function previous()
    {
        while ($this->currentIndex > 0) {
            $this->currentIndex--;
            $id = $this->invoiceIds[$this->currentIndex];
            $data = PharmacySaleInvoice::find($id);
            if ($data && $data->is_delete == 0) {
                $this->loadSaleInvoice($id);
                break;
            }
        }
    }

    public function next()
    {
        while ($this->currentIndex < count($this->invoiceIds) - 1) {
            $this->currentIndex++;
            $id = $this->invoiceIds[$this->currentIndex];
            $data = PharmacySaleInvoice::find($id);
            if ($data && $data->is_delete == 0) {
                $this->loadSaleInvoice($id);
                break;
            }
        }
    }

    public function loadSaleInvoice($id)
    {
        $data = PharmacySaleInvoice::with('saleInvoiceDetails')->findOrFail($id);
        $this->invoice_no = $data->invoice_no;

        if ($data->is_delete == 1) {
            // Clear other fields if the record is marked as deleted
            $this->patient_id = null;
            $this->invoice_date = null;
            $this->total_amount = null;
            $this->total_discount = null;
            $this->total_quantity = null;
            $this->net_amount = null;
            $this->paid_amount = null;
            $this->due_amount = null;
            $this->saleInvoiceDetails = [];
        } else {
            $this->id = $id;
            $this->patient_id = $data->patient_id;
            $this->invoice_date = $data->invoice_date;
            $this->total_amount = $data->total_amount;
            $this->total_discount = $data->total_discount;
            $this->total_quantity = $data->total_quantity;
            $this->net_amount = $data->net_amount;
            $this->paid_amount = $data->paid_amount;
            $this->due_amount = $data->due_amount;

            // Clear existing invoice details
            $this->saleInvoiceDetails = [];

            // Set invoice details
            foreach ($data->saleInvoiceDetails as $detail) {
                $this->saleInvoiceDetails[] = [
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
            'patient_name' => $this->patients->where('id', $this->patient_id)->first()->name ?? 'N/A',
            'invoice_no' => $this->invoice_no,
            'invoice_date' => $this->invoice_date,
            'currency' => 'AFN',
            'total_quantity' => $this->total_quantity,
            'total_amount' => $this->total_amount,
            'total_discount' => $this->total_discount,
            'net_amount' => $this->net_amount,
            'paid_amount' => $this->paid_amount,
            'due_amount' => $this->due_amount,
            'saleInvoiceDetails' => collect($this->saleInvoiceDetails)->map(function ($detail) {
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
        // Logic for printing the invoice details
        // This could involve generating a printable view or redirecting to a print page
        $this->dispatch('print', ['purchase_no' => $this->purchase_no]);
    }

    public function exportToExcel()
    {
        // Logic for exporting the invoice details to Excel
        // This could involve generating an Excel file and returning it as a download
        $this->dispatch('exportToExcel', ['purchase_no' => $this->purchase_no]);
    }

    public function exportToPDF()
    {
        // Logic for exporting the invoice details to PDF
        // This could involve generating a PDF file and returning it as a download
        $this->dispatch('exportToPDF', ['purchase_no' => $this->purchase_no]);
    }

    // Product search functionality
    public function searchProducts($index)
    {
        $this->isSearching = true;
        $this->showSearchResults = true;
        
        if (strlen($this->searchQuery) >= 2) {
            $this->searchResults = Product::where('is_delete', 0)
                ->where('is_active', 1)
                ->where(function($query) {
                    // Search only by name since there's no code column
                    $query->where('name', 'like', '%' . $this->searchQuery . '%');
                })
                ->whereHas('stock', function ($query) {
                    $query->where('quantity', '>', 0);
                })
                ->limit(10)
                ->get();
        } else {
            $this->searchResults = [];
        }
    }

    public function resetSearch()
    {
        $this->searchQuery = '';
        $this->searchResults = [];
        $this->showSearchResults = false;
        $this->isSearching = false;
    }

    public function selectProduct($index, $productId)
    {
        $this->saleInvoiceDetails[$index]['product_id'] = $productId;
        $this->fetchProductDetails($index);
        $this->resetSearch();
        
        // Dispatch an event to notify AlpineJS that a product was selected
        $this->dispatch('product-selected');
    }

    public function toggleProductDetails($index)
    {
        // Initialize the showDetails property if it doesn't exist
        if (!isset($this->saleInvoiceDetails[$index]['showDetails'])) {
            $this->saleInvoiceDetails[$index]['showDetails'] = false;
        }
        
        // Toggle the showDetails value
        $this->saleInvoiceDetails[$index]['showDetails'] = !$this->saleInvoiceDetails[$index]['showDetails'];
    }

    // Product search functionality
}