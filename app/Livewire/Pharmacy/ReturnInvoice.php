<?php

namespace App\Livewire\Pharmacy;

use App\Models\Pharmacy\Product;
use App\Models\Pharmacy\ReturnInvoice as PharmacyReturnInvoice;
use App\Models\Pharmacy\ReturnInvoiceDetail;
use App\Models\Pharmacy\Stock;
use App\Models\Pharmacy\StockSummary;
use App\Models\Reception\Patient;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;
use Livewire\WithFileUploads;
use Livewire\WithPagination;

class ReturnInvoice extends Component
{
    use WithFileUploads, WithPagination;

    // For Patient
    public $age, $patient_address;

    public $showCurrentData   = [];
    public $showEditData      = [];
    public $showSearchData    = [];

    public $patients;            // For patient dropdown
    public $products;            // For product dropdown (batchwise logic)
    public $latestReturnInvoice; // Show the latest invoice as default
    public $currentIndex   = 0;  // For next & previous
    public $invoiceIds     = []; // For next & previous

    public $previewData = [];    // For Preview button
    public $showModal   = false; // Controls modal visibility

    // For Return Invoice (master)
    public $id,
           $patient_id,
           $doctor_id,
           $return_invoice_id,
           $return_invoice_date,
           $print_date,
           $discount_id,
           $discount_reason,
           $payment_status,
           $payment_method,
           $created_by,
           $updated_by,
           $deleted_by;

    public $total_quantity = 0;
    public $total_amount   = 0.00;
    public $total_discount = 0.00;
    public $net_amount     = 0.00;
    public $paid_amount    = 0.00;
    public $due_amount     = 0.00;

    // For Return Invoice details
    public $product_id,
           $batch_no,
           $mfg_date,
           $expiry_date,
           $quantity,
           $bonus_quantity,
           $unit_price,
           $discount,
           $amount,
           $is_active,
           $is_delete;

    // For Return Invoice total calculation
    public $returnInvoiceDetails = [
        [
            'product_code'   => '',
            'product_name'   => '',
            'unit_price'     => '',
            'batch_no'       => '',
            'mfg_date'       => '',
            'expiry_date'    => '',
            'quantity'       => '',
            'bonus_quantity' => '',
            'discount'       => '',
            'amount'         => ''
        ]
    ];

    public $isEditing        = false;
    public $isStoring        = false;
    public $isUpdating       = false;
    public $isChangesEnabled = false;

    /**
     * Enable editing mode
     */
    public function enableEditing()
    {
        $this->isEditing = true;
        // Initialize the invoice_date if needed
        $this->return_invoice_date = now()->format('Y-m-d');
    }

    /**
     * Disable editing mode
     */
    public function disableEditing()
    {
        $this->isEditing = false;
    }

    /**
     * When patient is selected, fetch age & address
     */
    public function fetchStackholderDetails()
    {
        if ($this->patient_id) {
            $patient = Patient::find($this->patient_id);
            if ($patient) {
                $this->age             = $patient->age;
                $this->patient_address = $patient->address;
            } else {
                $this->age             = '';
                $this->patient_address = '';
            }
        }
    }

    /**
     * Mount the component
     */
    public function mount()
    {
        // Fetch active patients
        $this->patients = Patient::where('is_delete', 0)
                                 ->where('is_active', 1)
                                 ->orderBy('id', 'desc')
                                 ->get();

        // In the old approach: we fetch products that have stock >= 0 (batchwise logic)
        $this->products = Product::where('is_delete', 0)
                                 ->where('is_active', 1)
                                 ->whereHas('stock', function ($query) {
                                     $query->where('quantity', '>=', 0);
                                 })
                                 ->get();

        // Get stock info for each product batch-wise
        $this->products->each(function ($product) {
            $product->stock = $product->stock()
                                      ->where('quantity', '>=', 0)
                                      ->orderBy('batch_no')
                                      ->get();
        });

        // Show latest Return Invoice by default
        $this->fetchLatestReturnInvoice();
        // For next & previous
        $this->fetchInvoiceIds();
    }

    /**
     * Fetch product details from first available stock line
     * but let user override them manually
     */
    public function fetchProductDetails($index)
    {
        $productId = $this->returnInvoiceDetails[$index]['product_id'] ?? null;
        if (!$productId) {
            return;
        }

        // Prevent duplicates in the invoice detail
        foreach ($this->returnInvoiceDetails as $key => $detail) {
            if ($key != $index && $detail['product_id'] == $productId) {
                $this->dispatch('error', 'This product is already added to the invoice.');
                $this->returnInvoiceDetails[$index]['product_id'] = null;
                return;
            }
        }


        // Find the product
        $product = Product::find($productId);
        if ($product) {
            // Set product_name (optional)
            $this->returnInvoiceDetails[$index]['product_name'] = $product->name;

            // Optionally fetch the first available stock line
            $stock = $product->stock()
                             ->where('quantity', '>=', 0)
                             ->orderBy('batch_no')
                             ->first();
            if ($stock) {
                // Fill initial data from stock—BUT user can still override in the blade
                $this->returnInvoiceDetails[$index]['unit_price']  = $product->sale_price;
                $this->returnInvoiceDetails[$index]['batch_no']    = $stock->batch_no;
                $this->returnInvoiceDetails[$index]['mfg_date']    = $stock->mfg_date;
                $this->returnInvoiceDetails[$index]['expiry_date'] = $stock->expiry_date;
            } else {
                // If no stock line found, set them blank
                $this->returnInvoiceDetails[$index]['unit_price']  = '';
                $this->returnInvoiceDetails[$index]['batch_no']    = '';
                $this->returnInvoiceDetails[$index]['mfg_date']    = '';
                $this->returnInvoiceDetails[$index]['expiry_date'] = '';
            }
        }
    }


    /**
     * Return all selected product IDs
     */
    public function getSelectedProductIds()
    {
        return collect($this->returnInvoiceDetails)
            ->pluck('product_id')
            ->filter()
            ->toArray();
    }

    /**
     * Show the currently loaded data
     */
    public function fetchCurrentData()
    {
        $this->showCurrentData = [
            'patient_name'     => optional($this->patients->where('id', $this->patient_id)->first())->name ?? 'N/A',
            'return_invoice_id'=> $this->return_invoice_id,
            'return_invoice_date' => $this->return_invoice_date,
            'currency'         => 'AFN',
            'total_quantity'   => $this->total_quantity,
            'total_amount'     => $this->total_amount,
            'total_discount'   => $this->total_discount,
            'net_amount'       => $this->net_amount,
            'paid_amount'      => $this->paid_amount,
            'due_amount'       => $this->due_amount,
            'returnInvoiceDetails' => collect($this->returnInvoiceDetails)->map(function ($detail) {
                return [
                    'quantity'       => $detail['quantity']       ?? 0,
                    'bonus_quantity' => $detail['bonus_quantity'] ?? 0,
                    'product_name'   => optional(Product::find($detail['product_id']))->name ?? 'N/A',
                    'batch_no'       => $detail['batch_no']       ?? '',
                    'mfg_date'       => $detail['mfg_date']       ?? '',
                    'expiry_date'    => $detail['expiry_date']    ?? '',
                    'unit_price'     => $detail['unit_price']     ?? 0,
                    'discount'       => $detail['discount']       ?? 0,
                    'amount'         => $detail['amount']         ?? 0,
                ];
            })->toArray(),
        ];
    }

    /**
     * Fetch invoice by return_invoice_id
     */
    public function fetchSelectedData($invoiceNo)
    {
        $invoice = PharmacyReturnInvoice::where('return_invoice_id', $invoiceNo)
            ->with('patient', 'returnInvoiceDetails')
            ->first();

        if ($invoice) {
            $this->patient_id          = $invoice->patient_id;
            $this->return_invoice_id   = $invoice->return_invoice_id;
            $this->return_invoice_date = $invoice->return_invoice_date;
            $this->age                 = optional($invoice->patient)->age ?? 'N/A';
            $this->patient_address     = optional($invoice->patient)->address ?? 'N/A';
            $this->total_quantity      = $invoice->total_quantity;
            $this->total_discount      = $invoice->total_discount;
            $this->total_amount        = $invoice->total_amount;
            $this->net_amount          = $invoice->net_amount;
            $this->paid_amount         = $invoice->paid_amount;
            $this->due_amount          = $invoice->due_amount;

            // Fill details
            $this->returnInvoiceDetails = collect($invoice->returnInvoiceDetails)->map(function ($detail) {
                return [
                    'product_id'     => $detail->product_id,
                    'product_name'   => optional(Product::find($detail->product_id))->name ?? 'N/A',
                    'batch_no'       => $detail->batch_no,
                    'mfg_date'       => $detail->mfg_date,
                    'expiry_date'    => $detail->expiry_date,
                    'quantity'       => $detail->quantity,
                    'bonus_quantity' => $detail->bonus_quantity,
                    'unit_price'     => $detail->unit_price,
                    'discount'       => $detail->discount,
                    'amount'         => $detail->amount,
                ];
            })->toArray();

            $this->dispatch('close-modal');
        }
    }

    /**
     * Fetch the latest Return Invoice
     */
    public function fetchLatestReturnInvoice()
    {
        $this->latestReturnInvoice = PharmacyReturnInvoice::where('is_delete', 0)
            ->where('is_active', 1)
            ->latest()
            ->with('patient', 'returnInvoiceDetails')
            ->first();

        if ($this->latestReturnInvoice) {
            $this->patient_id          = $this->latestReturnInvoice->patient_id;
            $this->return_invoice_id   = $this->latestReturnInvoice->return_invoice_id;
            $this->return_invoice_date = $this->latestReturnInvoice->return_invoice_date;
            $this->age                 = optional($this->latestReturnInvoice->patient)->age ?? '';
            $this->patient_address     = optional($this->latestReturnInvoice->patient)->address ?? '';
            $this->total_quantity      = $this->latestReturnInvoice->total_quantity;
            $this->total_discount      = $this->latestReturnInvoice->total_discount;
            $this->total_amount        = $this->latestReturnInvoice->total_amount;
            $this->net_amount          = $this->latestReturnInvoice->net_amount;
            $this->paid_amount         = $this->latestReturnInvoice->paid_amount;
            $this->due_amount          = $this->latestReturnInvoice->due_amount;

            $this->returnInvoiceDetails = $this->latestReturnInvoice->returnInvoiceDetails->toArray();
        }
    }

    /**
     * Calculate totals
     */
    public function calculateTotals()
    {
        $this->total_quantity = 0;
        $this->total_amount   = 0.00;
        $this->total_discount = 0.00;

        foreach ($this->returnInvoiceDetails as $detail) {
            $qty  = (float) ($detail['quantity']   ?? 0);
            $uPrice = (float) ($detail['unit_price'] ?? 0);
            $dcPct  = (float) ($detail['discount']   ?? 0);

            $this->total_quantity += $qty;
            $this->total_amount   += $qty * $uPrice;
            $this->total_discount += ($qty * $uPrice) * ($dcPct / 100);
        }

        $this->net_amount = $this->total_amount - $this->total_discount;
        $this->due_amount = $this->net_amount - $this->paid_amount;
    }

    /**
     * Calculate item amount line by line
     * (No stock limit on quantity)
     */
    public function calculateItemAmount($index)
    {
        $quantity  = (float) ($this->returnInvoiceDetails[$index]['quantity']   ?? 0);
        $unitPrice = (float) ($this->returnInvoiceDetails[$index]['unit_price'] ?? 0);
        $discount  = (float) ($this->returnInvoiceDetails[$index]['discount']   ?? 0);

        $discountAmount = ($quantity * $unitPrice) * ($discount / 100);
        $this->returnInvoiceDetails[$index]['amount'] = ($quantity * $unitPrice) - $discountAmount;

        $this->calculateTotals();
    }

    /**
     * Update due amount if paid_amount changes
     */
    public function calculateDueAmount()
    {
        $this->due_amount = $this->net_amount - $this->paid_amount;
    }

    /**
     * Listen for changes in ReturnInvoiceDetails or paid_amount
     */
    public function updated($propertyName)
    {
        if (strpos($propertyName, 'returnInvoiceDetails') !== false) {
            $this->calculateTotals();
        } elseif ($propertyName === 'paid_amount') {
            $this->calculateDueAmount();
        }
    }

    /**
     * Add a blank row
     */
    public function addItem()
    {
        $this->returnInvoiceDetails[] = [
            'product_id'     => '',
            'product_name'   => '',
            'unit_price'     => '',
            'batch_no'       => '',
            'mfg_date'       => '',
            'expiry_date'    => '',
            'quantity'       => '',
            'bonus_quantity' => '',
            'discount'       => '',
            'amount'         => ''
        ];
    }

    /**
     * Remove a row
     */
    public function removeReturnInvoiceDetail($index)
    {
        unset($this->returnInvoiceDetails[$index]);
        $this->returnInvoiceDetails = array_values($this->returnInvoiceDetails);
        $this->calculateTotals();
    }

    /**
     * Render the Livewire component
     */
    public function render()
    {
        // Re-fetch patients & products
        // (with batch logic if you want them in the dropdown)
        $patients = Patient::where('is_delete', 0)->where('is_active', 1)->get();
        $products = Product::where('is_delete', 0)
                           ->where('is_active', 1)
                           ->whereHas('stock', function ($query) {
                               $query->where('quantity', '>=', 0);
                           })
                           ->orderBy('id', 'desc')
                           ->get();

        // batch-wise stock info if needed
        $products->each(function ($product) {
            $product->stock = $product->stock()
                                      ->where('quantity', '>=', 0)
                                      ->orderBy('batch_no')
                                      ->get();
        });

        $invoices = PharmacyReturnInvoice::where('is_delete', 0)
                                         ->where('is_active', 1)
                                         ->with('patient', 'returnInvoiceDetails', 'user')
                                         ->latest()
                                         ->get();

        return view('livewire.pharmacy.return-invoice', [
            'invoices' => $invoices,
            'patients' => $patients,
            'products' => $products,
        ]);
    }

    /**
     * Reset input fields
     */
    private function resetInputFields()
    {
        $invoices = PharmacyReturnInvoice::where('is_active', 1)
                                         ->with('patient', 'returnInvoiceDetails', 'user')
                                         ->latest()
                                         ->get();

        $this->id             = null;
        $this->patient_id     = null;
        $this->age            = null;
        $this->patient_address= null;

        // Suppose we auto-increment the invoice number
        $this->return_invoice_id = $invoices->max('return_invoice_id') + 1;
        $this->total_amount    = 0;
        $this->total_discount  = 0;
        $this->total_quantity  = 0;
        $this->net_amount      = 0;
        $this->paid_amount     = 0;
        $this->due_amount      = 0;

        $this->returnInvoiceDetails = [[
            'product_id'     => '',
            'product_name'   => '',
            'unit_price'     => '',
            'batch_no'       => '',
            'mfg_date'       => '',
            'expiry_date'    => '',
            'quantity'       => '',
            'bonus_quantity' => '',
            'discount'       => '',
            'amount'         => ''
        ]];
    }

    /**
     * Create a new record
     */
    public function new()
    {
        $this->resetInputFields();
        $this->isChangesEnabled = true;
        $this->isStoring        = true;
        $this->enableEditing();
    }

    /**
     * Cancel the store operation
     */
    public function cancel_store()
    {
        $this->isChangesEnabled = false;
        $this->isStoring        = false;
        $this->isUpdating       = false;
        $this->fetchLatestReturnInvoice();
        $this->disableEditing();
    }

    /**
     * Cancel the update operation
     */
    public function cancel_update()
    {
        $this->isChangesEnabled = false;
        $this->isStoring        = false;
        $this->isUpdating       = false;
        $this->fetchCurrentData();
        $this->disableEditing();
    }

    /**
     * Store (create) a new Return Invoice
     */
    public function store()
    {
        // Validate
        $this->validate([
            'patient_id'                        => 'required|exists:patients,id',
            'return_invoice_date'               => 'required|date',
            'returnInvoiceDetails.*.product_id' => 'required|exists:products,id',
            'returnInvoiceDetails.*.unit_price' => 'required|numeric',
            'returnInvoiceDetails.*.mfg_date'   => 'required|date',
            'returnInvoiceDetails.*.expiry_date'=> 'required|date',
            'returnInvoiceDetails.*.quantity'   => 'required|integer|min:1',
            'returnInvoiceDetails.*.discount'   => 'nullable|numeric|min:0',
            'returnInvoiceDetails.*.amount'     => 'required|numeric|min:0',
        ]);

        $user_id = Auth::id();

        // Create ReturnInvoice master
        $return_invoice = PharmacyReturnInvoice::create([
            'patient_id'          => $this->patient_id,
            'return_invoice_id'   => $this->return_invoice_id,
            'return_invoice_date' => $this->return_invoice_date,
            'total_amount'        => $this->total_amount,
            'total_discount'      => $this->total_discount,
            'total_quantity'      => $this->total_quantity,
            'net_amount'          => $this->net_amount,
            'paid_amount'         => $this->paid_amount,
            'due_amount'          => $this->due_amount,
            'created_by'          => $user_id,
        ]);

        // Create ReturnInvoiceDetail + update/add stock
        foreach ($this->returnInvoiceDetails as $detail) {
            ReturnInvoiceDetail::create([
                'return_invoice_id' => $return_invoice->id,
                'product_id'        => $detail['product_id'],
                'unit_price'        => $detail['unit_price'],
                'batch_no'          => $detail['batch_no'] ?: null,
                'mfg_date'          => $detail['mfg_date'],
                'expiry_date'       => $detail['expiry_date'],
                'quantity'          => $detail['quantity'],
                'bonus_quantity'    => $detail['bonus_quantity'] ?: 0,
                'discount'          => $detail['discount'] ?: 0,
                'amount'            => $detail['amount'],
                'created_by'        => $user_id,
            ]);

            // Update or Insert Stock
            $stock = Stock::where('product_id', $detail['product_id'])
                          ->where('batch_no',   $detail['batch_no'])
                          ->first();
            if ($stock) {
                // Add returned quantity into stock
                $stock->update([
                    'quantity'  => $stock->quantity + $detail['quantity'],
                    'bonus'     => $stock->bonus    + ($detail['bonus_quantity'] ?: 0),
                    'discount'  => $stock->discount + ($detail['discount'] ?: 0),
                    'amount'    => $stock->amount   + $detail['amount'],
                    'updated_by'=> $user_id,
                ]);
            } else {
                Stock::create([
                    'product_id'       => $detail['product_id'],
                    'unit_price'       => $detail['unit_price'],
                    'batch_no'         => $detail['batch_no'] ?: null,
                    'mfg_date'         => $detail['mfg_date'],
                    'expiry_date'      => $detail['expiry_date'],
                    'quantity'         => $detail['quantity'],
                    'bonus'            => $detail['bonus_quantity'] ?: 0,
                    'discount'         => $detail['discount']       ?: 0,
                    'amount'           => $detail['amount'],
                    'transaction_id'   => $return_invoice->id,
                    'transaction_type' => 'return_invoice',
                    'created_by'       => $user_id,
                ]);
            }

            // Update StockSummary
            $latestSummary = StockSummary::where('product_id', $detail['product_id'])
                                         ->orderBy('created_at', 'desc')
                                         ->first();
            $openingQuantity = $latestSummary ? $latestSummary->closing_quantity : 0;

            $qty   = (int) $detail['quantity'];
            $bonus = (int) ($detail['bonus_quantity'] ?: 0);

            // For a RETURN, add qty + bonus
            $closingQuantity = $openingQuantity + ($qty + $bonus);
            $closingAmount   = $closingQuantity * (float) $detail['unit_price'];

            StockSummary::create([
                'product_id'       => $detail['product_id'],
                'opening_quantity' => $openingQuantity,
                'return_quantity'  => $qty + $bonus,
                'closing_quantity' => $closingQuantity,
                'closing_amount'   => $closingAmount,
                'transaction_id'   => $return_invoice->id,
                'transaction_type' => 'return_invoice',
                'created_by'       => $user_id,
            ]);
        }

        $this->disableEditing();
        $this->isChangesEnabled = false;
        $this->isStoring        = false;
        $this->fetchCurrentData();

        $this->dispatch('success', 'Return invoice details saved successfully.');
    }

    /**
     * Edit existing invoice record
     */
    public function edit()
    {
        $this->disableEditing();
        $this->isChangesEnabled = true;
        $this->isUpdating       = true;
        $this->enableEditing();

        // Optionally populate $this->showEditData if needed
    }

    /**
     * Update existing invoice record
     */
    public function update()
    {
        $this->validate([
            'patient_id'                        => 'required|exists:patients,id',
            'return_invoice_date'               => 'required|date',
            'returnInvoiceDetails.*.product_id' => 'required|exists:products,id',
            'returnInvoiceDetails.*.unit_price' => 'required|numeric',
            'returnInvoiceDetails.*.mfg_date'   => 'required|date',
            'returnInvoiceDetails.*.expiry_date'=> 'required|date',
            'returnInvoiceDetails.*.quantity'   => 'required|integer|min:1',
            'returnInvoiceDetails.*.discount'   => 'nullable|numeric|min:0',
            'returnInvoiceDetails.*.amount'     => 'required|numeric|min:0',
        ]);

        $user_id = Auth::id();
        $data = PharmacyReturnInvoice::where('return_invoice_id', $this->return_invoice_id)->first();
        if (!$data) {
            $this->dispatch('error', 'Return Invoice not found.');
            return;
        }

        $data->update([
            'patient_id'          => $this->patient_id,
            'return_invoice_date' => $this->return_invoice_date,
            'total_amount'        => $this->total_amount,
            'total_discount'      => $this->total_discount,
            'total_quantity'      => $this->total_quantity,
            'net_amount'          => $this->net_amount,
            'paid_amount'         => $this->paid_amount,
            'due_amount'          => $this->due_amount,
            'updated_by'          => $user_id,
        ]);

        // Simplified stock revert / new stock logic...
        foreach ($this->returnInvoiceDetails as $detail) {
            $existingDetail = ReturnInvoiceDetail::where('return_invoice_id', $data->id)
                ->where('product_id', $detail['product_id'])
                ->where('batch_no', $detail['batch_no'])
                ->first();

            $newQty   = (int) ($detail['quantity']       ?? 0);
            $bonusQty = (int) ($detail['bonus_quantity'] ?? 0);

            if ($existingDetail) {
                // Revert old
                $oldQty   = $existingDetail->quantity;
                $oldBonus = $existingDetail->bonus_quantity;

                $existingDetail->update([
                    'unit_price'     => $detail['unit_price'],
                    'mfg_date'       => $detail['mfg_date'],
                    'expiry_date'    => $detail['expiry_date'],
                    'quantity'       => $newQty,
                    'bonus_quantity' => $bonusQty,
                    'discount'       => $detail['discount'] ?: 0,
                    'amount'         => $detail['amount']   ?: 0,
                    'updated_by'     => $user_id,
                ]);

                // Stock
                $stock = Stock::where('product_id', $detail['product_id'])
                              ->where('batch_no',   $detail['batch_no'])
                              ->first();
                if ($stock) {
                    $stock->update([
                        'quantity' => $stock->quantity - $oldQty,
                        'bonus'    => $stock->bonus    - $oldBonus,
                    ]);
                    $stock->update([
                        'quantity'  => $stock->quantity + $newQty,
                        'bonus'     => $stock->bonus    + $bonusQty,
                        'amount'    => $stock->amount   + ($detail['amount'] ?: 0),
                        'updated_by'=> $user_id,
                    ]);
                } else {
                    Stock::create([
                        'product_id'       => $detail['product_id'],
                        'unit_price'       => $detail['unit_price'],
                        'batch_no'         => $detail['batch_no'] ?: null,
                        'mfg_date'         => $detail['mfg_date'],
                        'expiry_date'      => $detail['expiry_date'],
                        'quantity'         => $newQty,
                        'bonus'            => $bonusQty,
                        'discount'         => $detail['discount'] ?: 0,
                        'amount'           => $detail['amount']   ?: 0,
                        'transaction_id'   => $data->id,
                        'transaction_type' => 'return_invoice',
                        'created_by'       => $user_id,
                    ]);
                }
                // StockSummary update logic...
            }
            else {
                // Create new detail
                ReturnInvoiceDetail::create([
                    'return_invoice_id' => $data->id,
                    'product_id'        => $detail['product_id'],
                    'batch_no'          => $detail['batch_no'] ?: null,
                    'unit_price'        => $detail['unit_price'],
                    'mfg_date'          => $detail['mfg_date'],
                    'expiry_date'       => $detail['expiry_date'],
                    'quantity'          => $newQty,
                    'bonus_quantity'    => $bonusQty,
                    'discount'          => $detail['discount'] ?: 0,
                    'amount'            => $detail['amount']   ?: 0,
                    'created_by'        => $user_id,
                ]);

                // Insert / Update stock
                $stock = Stock::where('product_id', $detail['product_id'])
                              ->where('batch_no',   $detail['batch_no'])
                              ->first();
                if ($stock) {
                    $stock->update([
                        'quantity'  => $stock->quantity + $newQty,
                        'bonus'     => $stock->bonus    + $bonusQty,
                        'discount'  => $stock->discount + ($detail['discount'] ?: 0),
                        'amount'    => $stock->amount   + ($detail['amount']   ?: 0),
                        'updated_by'=> $user_id,
                    ]);
                } else {
                    Stock::create([
                        'product_id'       => $detail['product_id'],
                        'unit_price'       => $detail['unit_price'],
                        'batch_no'         => $detail['batch_no'] ?: null,
                        'mfg_date'         => $detail['mfg_date'],
                        'expiry_date'      => $detail['expiry_date'],
                        'quantity'         => $newQty,
                        'bonus'            => $bonusQty,
                        'discount'         => $detail['discount'] ?: 0,
                        'amount'           => $detail['amount']   ?: 0,
                        'transaction_id'   => $data->id,
                        'transaction_type' => 'return_invoice',
                        'created_by'       => $user_id,
                    ]);
                }
                // StockSummary...
            }
        }

        $this->disableEditing();
        $this->isChangesEnabled = false;
        $this->isUpdating       = false;
        $this->fetchCurrentData();

        $this->dispatch('success', 'Return invoice updated successfully.');
    }

    /**
     * Search operation
     */
    public function search()
    {
        $this->showSearchData = PharmacyReturnInvoice::with('patient')
            ->get(['return_invoice_id', 'return_invoice_date', 'patient_id'])
            ->map(function ($invoice) {
                return [
                    'return_invoice_id'   => $invoice->return_invoice_id,
                    'patient_name'        => optional($invoice->patient)->name ?? 'N/A',
                    'return_invoice_date' => $invoice->return_invoice_date,
                ];
            })
            ->toArray();
    }

    /**
     * Delete invoice (soft-delete)
     */
    public function delete($id)
    {
        $user_id = Auth::id();

        $data = PharmacyReturnInvoice::with('returnInvoiceDetails')->findOrFail($id);
        $data->update([
            'is_delete'  => 1,
            'deleted_by' => $user_id,
            'deleted_at' => now(),
        ]);

        foreach ($data->returnInvoiceDetails as $detail) {
            $detail->update([
                'is_delete'  => 1,
                'deleted_by' => $user_id,
                'deleted_at' => now(),
            ]);

            // Revert stock if undoing
            $stock = Stock::where('product_id', $detail->product_id)
                          ->where('batch_no',   $detail->batch_no)
                          ->first();
            if ($stock) {
                $stock->update([
                    'quantity' => $stock->quantity - $detail->quantity,
                    'bonus'    => $stock->bonus    - $detail->bonus_quantity,
                    'updated_by'=> $user_id,
                ]);
            }
            // StockSummary revert...
        }

        $this->disableEditing();
        $this->isChangesEnabled = false;
        $this->fetchLatestReturnInvoice();
        $this->dispatch('success', 'Return invoice deleted successfully.');
    }

    /**
     * For next/previous
     */
    public function fetchInvoiceIds()
    {
        $this->invoiceIds = PharmacyReturnInvoice::where('is_active', 1)
            ->where('is_delete', 0)
            ->orderBy('id', 'asc')
            ->pluck('id')
            ->toArray();
    }

    public function previous()
    {
        while ($this->currentIndex > 0) {
            $this->currentIndex--;
            $id   = $this->invoiceIds[$this->currentIndex];
            $data = PharmacyReturnInvoice::find($id);

            if ($data && $data->is_delete == 0) {
                $this->loadReturnInvoice($id);
                break;
            }
        }
    }

    public function next()
    {
        while ($this->currentIndex < count($this->invoiceIds) - 1) {
            $this->currentIndex++;
            $id   = $this->invoiceIds[$this->currentIndex];
            $data = PharmacyReturnInvoice::find($id);

            if ($data && $data->is_delete == 0) {
                $this->loadReturnInvoice($id);
                break;
            }
        }
    }

    public function loadReturnInvoice($id)
    {
        $data = PharmacyReturnInvoice::with('returnInvoiceDetails')->findOrFail($id);
        $this->return_invoice_id = $data->return_invoice_id;

        if ($data->is_delete == 1) {
            $this->patient_id          = null;
            $this->return_invoice_date = null;
            $this->total_amount        = null;
            $this->total_discount      = null;
            $this->total_quantity      = null;
            $this->net_amount          = null;
            $this->paid_amount         = null;
            $this->due_amount          = null;
            $this->returnInvoiceDetails= [];
        } else {
            $this->id                  = $id;
            $this->patient_id          = $data->patient_id;
            $this->return_invoice_date = $data->return_invoice_date;
            $this->total_amount        = $data->total_amount;
            $this->total_discount      = $data->total_discount;
            $this->total_quantity      = $data->total_quantity;
            $this->net_amount          = $data->net_amount;
            $this->paid_amount         = $data->paid_amount;
            $this->due_amount          = $data->due_amount;

            $this->returnInvoiceDetails = [];
            foreach ($data->returnInvoiceDetails as $detail) {
                $this->returnInvoiceDetails[] = [
                    'product_id'     => $detail->product_id,
                    'batch_no'       => $detail->batch_no,
                    'mfg_date'       => $detail->mfg_date,
                    'expiry_date'    => $detail->expiry_date,
                    'quantity'       => $detail->quantity,
                    'bonus_quantity' => $detail->bonus_quantity,
                    'unit_price'     => $detail->unit_price,
                    'discount'       => $detail->discount,
                    'amount'         => $detail->amount,
                ];
            }
        }
    }

    /**
     * Preview invoice before printing
     */
    public function preview()
    {
        $this->previewData = [
            'patient_name'   => optional($this->patients->where('id', $this->patient_id)->first())->name ?? 'N/A',
            'invoice_no'     => $this->return_invoice_id,
            'invoice_date'   => $this->return_invoice_date,
            'currency'       => 'AFN',
            'total_quantity' => $this->total_quantity,
            'total_amount'   => $this->total_amount,
            'total_discount' => $this->total_discount,
            'net_amount'     => $this->net_amount,
            'paid_amount'    => $this->paid_amount,
            'due_amount'     => $this->due_amount,
            'returnInvoiceDetails' => collect($this->returnInvoiceDetails)->map(function ($detail) {
                return [
                    'quantity'       => $detail['quantity']       ?? 0,
                    'bonus_quantity' => $detail['bonus_quantity'] ?? 0,
                    'product_name'   => optional(Product::find($detail['product_id']))->name ?? 'N/A',
                    'batch_no'       => $detail['batch_no']       ?? '',
                    'mfg_date'       => $detail['mfg_date']       ?? '',
                    'expiry_date'    => $detail['expiry_date']    ?? '',
                    'unit_price'     => $detail['unit_price']     ?? 0,
                    'discount'       => $detail['discount']       ?? 0,
                    'amount'         => $detail['amount']         ?? 0,
                ];
            })->toArray(),
        ];

        $this->showModal = true;
    }

    public function closeModal()
    {
        $this->showModal = false;
    }

    public function print()
    {
        $this->dispatch('print', ['return_invoice_id' => $this->return_invoice_id]);
    }

    public function exportToExcel()
    {
        $this->dispatch('exportToExcel', ['return_invoice_id' => $this->return_invoice_id]);
    }

    public function exportToPDF()
    {
        $this->dispatch('exportToPDF', ['return_invoice_id' => $this->return_invoice_id]);
    }
}
