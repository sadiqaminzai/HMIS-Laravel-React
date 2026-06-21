<div class="container-fluid">
    <div class="container">
        <div class="card">
            <!-- Card Header: Return Invoice -->
            <div class="card-header">
                <h4>Return Invoice</h4>
            </div>

            <div class="card-body">
                <form wire:submit.prevent="store">
                    <!-- Header Section for Return Invoice Information -->
                    <div class="purchase-general-info">
                        <div class="row">
                            <div class="col-md-6">
                                <!-- Patient Dropdown or Display -->
                                <div class="form-group @error('patient_id') has-error @enderror">
                                    @if($isChangesEnabled)
                                        <select
                                            class="form-control form-control-sm"
                                            id="patient_id"
                                            name="patient_id"
                                            wire:model="patient_id"
                                            wire:change="fetchStackholderDetails"
                                        >
                                            <option value="">--SELECT patient--</option>
                                            @foreach($patients as $patient)
                                                <option value="{{ $patient->id }}">
                                                    {{ strtoupper($patient->name) }}
                                                </option>
                                            @endforeach
                                        </select>
                                        @error('patient_id')
                                            <span class="text-danger">{{ $message }}</span>
                                        @enderror
                                    @else
                                        @foreach($patients as $patient)
                                            @if($patient->id == $patient_id)
                                                <div class="row">
                                                    <div class="col-md-3 text-info">Patient Name:</div>
                                                    <div class="col-md-9">{{ strtoupper($patient->name) }}</div>
                                                </div>
                                            @endif
                                        @endforeach
                                    @endif
                                </div>
                                <div class="form-group @error('patient_id') has-error @enderror">
                                    <!-- Additional fields if needed -->
                                </div>
                            </div>

                            <div class="col-md-2"></div>

                            <!-- Return Invoice No -->
                            <div class="col-md-2">
                                <div class="form-group @error('return_invoice_id') has-error @enderror">
                                    <input
                                        type="text"
                                        class="form-control form-control-sm"
                                        id="return_invoice_id"
                                        name="return_invoice_id"
                                        wire:model="return_invoice_id"
                                        placeholder="Invoice No"
                                        disabled
                                    >
                                    @error('return_invoice_id')
                                        <span class="text-danger">{{ $message }}</span>
                                    @enderror
                                </div>
                            </div>

                            <!-- Return Invoice Date -->
                            <div class="col-md-2">
                                <div class="form-group @error('return_invoice_date') has-error @enderror">
                                    <input
                                        type="date"
                                        class="form-control form-control-sm"
                                        id="return_invoice_date"
                                        name="return_invoice_date"
                                        wire:model="return_invoice_date"
                                        @if(!$isEditing) disabled @endif
                                    >
                                    @error('return_invoice_date')
                                        <span class="text-danger">{{ $message }}</span>
                                    @enderror
                                </div>
                            </div>
                        </div> <!-- /.row -->

                        <!-- Age, Address, Invoice# (again, if needed) -->
                        <div class="row">
                            <div class="col-md-6">
                                <div class="row">
                                    <div class="col-md-3 text-info">Age:</div>
                                    <div class="col-md-9 justify-content-start">
                                        {{ $age }} year(s)
                                    </div>
                                </div>
                            </div>
                            <div class="col-md-4"></div>
                            <div class="col-md-2">
                                <!-- Print Date (if needed) -->
                            </div>
                        </div>

                        <div class="row">
                            <div class="col-md-6">
                                <div class="row">
                                    <div class="col-md-3 text-info">Address:</div>
                                    <div class="col-md-9">
                                        {{ strtoupper($patient_address) }}
                                    </div>
                                </div>
                            </div>

                            <div class="col-md-4"></div>

                            <div class="col-md-2">
                                <div class="form-group @error('return_invoice_id') has-error @enderror">
                                    <input
                                        type="text"
                                        class="form-control form-control-sm"
                                        id="return_invoice_id"
                                        name="return_invoice_id"
                                        wire:model="return_invoice_id"
                                        placeholder="Invoice#"
                                        @if(!$isEditing) disabled @endif
                                    >
                                    @error('return_invoice_id')
                                        <span class="text-danger">{{ $message }}</span>
                                    @enderror
                                </div>
                            </div>
                        </div>
                    </div> <!-- /.purchase-general-info -->

                    <!-- Body Section for Return Items -->
                    <div class="row mt-2">
                        <div class="col-md-12">
                            <div class="card">
                                <div class="card-body">
                                    <div
                                        class="table-responsive"
                                        style="min-height: 196px; max-height: 196px; overflow-y: auto;"
                                    >
                                        <table class="table table-bordered table-hover" style="border-spacing: 0; border-collapse: collapse;">
                                            <thead>
                                                <tr>
                                                    <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Product Name</th>
                                                    <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Unit Price</th>
                                                    <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Batch No</th>
                                                    <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Mfg. Date</th>
                                                    <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Expiry</th>
                                                    <!-- Removed the Stock column completely -->
                                                    <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Quantity</th>
                                                    <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Discount</th>
                                                    <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Amount (AFN)</th>
                                                    @if($isEditing)
                                                        <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Action</th>
                                                    @endif
                                                </tr>
                                            </thead>

                                            <tbody>
                                                @foreach ($returnInvoiceDetails as $key => $returnDetail)
                                                    <tr>
                                                        <!-- Product Name / Dropdown -->
                                                        <td>
                                                            <div class="form-group @error('patient_id') has-error @enderror">
                                                                @if($isChangesEnabled)
                                                                    <select
                                                                        class="form-control form-control-sm"
                                                                        id="product_id.{{ $key }}"
                                                                        name="product_id.{{ $key }}"
                                                                        wire:model="returnInvoiceDetails.{{ $key }}.product_id"
                                                                        wire:change="fetchProductDetails({{ $key }})"
                                                                        onchange="focusNextField('unit_price.{{ $key }}')"
                                                                    >
                                                                        <option value="">--Select--</option>
                                                                        @foreach($products as $product)
                                                                            <option
                                                                                value="{{ $product->id }}"
                                                                                @if(in_array($product->id, $this->getSelectedProductIds()))
                                                                                    disabled
                                                                                @endif
                                                                            >
                                                                                {{ strtoupper($product->name) }}
                                                                            </option>
                                                                        @endforeach
                                                                    </select>
                                                                @else
                                                                    <!-- View mode -->
                                                                    @php
                                                                        $productName = null;
                                                                        foreach($products as $p) {
                                                                            if($p->id == ($returnDetail['product_id'] ?? null)) {
                                                                                $productName = strtoupper($p->name);
                                                                                break;
                                                                            }
                                                                        }
                                                                    @endphp
                                                                    {{ $productName }}
                                                                @endif
                                                            </div>
                                                        </td>

                                                       <!-- Unit Price -->
                                                        <td>
                                                            @if($isChangesEnabled)
                                                                <input
                                                                    type="text"
                                                                    class="form-control form-control-sm"
                                                                    id="unit_price.{{ $key }}"
                                                                    name="unit_price.{{ $key }}"
                                                                    wire:model.defer="returnInvoiceDetails.{{ $key }}.unit_price"
                                                                    onkeydown="focusNextOnEnter(event, 'batch_no.{{ $key }}')"
                                                                >
                                                            @else
                                                                @if(isset($returnDetail['unit_price']))
                                                                    {{ strtoupper($returnDetail['unit_price']) }}
                                                                @endif
                                                            @endif
                                                        </td>

                                                        <!-- Batch No -->
                                                        <td>
                                                            @if($isChangesEnabled)
                                                                <input
                                                                    type="text"
                                                                    class="form-control form-control-sm"
                                                                    id="batch_no.{{ $key }}"
                                                                    name="batch_no.{{ $key }}"
                                                                    wire:model.defer="returnInvoiceDetails.{{ $key }}.batch_no"
                                                                    onkeydown="focusNextOnEnter(event, 'mfg_date.{{ $key }}')"
                                                                >
                                                            @else
                                                                @if(isset($returnDetail['batch_no']))
                                                                    {{ strtoupper($returnDetail['batch_no']) }}
                                                                @endif
                                                            @endif
                                                        </td>

                                                        <!-- Mfg Date -->
                                                        <td>
                                                            @if($isChangesEnabled)
                                                                <input
                                                                    type="date"
                                                                    class="form-control form-control-sm"
                                                                    id="mfg_date.{{ $key }}"
                                                                    name="mfg_date.{{ $key }}"
                                                                    wire:model.defer="returnInvoiceDetails.{{ $key }}.mfg_date"
                                                                    onkeydown="focusNextOnEnter(event, 'expiry_date.{{ $key }}')"
                                                                >
                                                            @else
                                                                @if(isset($returnDetail['mfg_date']))
                                                                    {{ $returnDetail['mfg_date'] }}
                                                                @endif
                                                            @endif
                                                        </td>

                                                        <!-- Expiry Date -->
                                                        <td>
                                                            @if($isChangesEnabled)
                                                                <input
                                                                    type="date"
                                                                    class="form-control form-control-sm"
                                                                    id="expiry_date.{{ $key }}"
                                                                    name="expiry_date.{{ $key }}"
                                                                    wire:model.defer="returnInvoiceDetails.{{ $key }}.expiry_date"
                                                                    onkeydown="focusNextOnEnter(event, 'quantity.{{ $key }}')"
                                                                >
                                                            @else
                                                                @if(isset($returnDetail['expiry_date']))
                                                                    {{ $returnDetail['expiry_date'] }}
                                                                @endif
                                                            @endif
                                                        </td>

                                                        <!-- Quantity -->
                                                        <td>
                                                            @if($isChangesEnabled)
                                                                <input
                                                                    type="text"
                                                                    class="form-control form-control-sm"
                                                                    id="quantity.{{ $key }}"
                                                                    name="quantity.{{ $key }}"
                                                                    wire:model.lazy="returnInvoiceDetails.{{ $key }}.quantity"
                                                                    wire:blur="calculateItemAmount({{ $key }})"
                                                                    onkeydown="focusNextOnEnter(event, 'discount.{{ $key }}')"
                                                                >
                                                            @else
                                                                @if(isset($returnDetail['quantity']))
                                                                    {{ $returnDetail['quantity'] }}
                                                                @endif
                                                            @endif
                                                        </td>

                                                        <!-- Discount -->
                                                        <td>
                                                            @if($isChangesEnabled)
                                                                <input
                                                                    type="text"
                                                                    class="form-control form-control-sm"
                                                                    id="discount.{{ $key }}"
                                                                    name="discount.{{ $key }}"
                                                                    wire:model.lazy="returnInvoiceDetails.{{ $key }}.discount"
                                                                    wire:blur="calculateItemAmount({{ $key }})"
                                                                    oninput="this.value = this.value.replace(/[^0-9]/g, '');"
                                                                    autocomplete="off"
                                                                >
                                                            @else
                                                                @if(isset($returnDetail['discount']))
                                                                    {{ $returnDetail['discount'] }}
                                                                @endif
                                                            @endif
                                                        </td>

                                                        <!-- Amount -->
                                                        <td>
                                                            @if($isChangesEnabled)
                                                                <input
                                                                    type="number"
                                                                    class="form-control form-control-sm"
                                                                    id="amount.{{ $key }}"
                                                                    name="amount.{{ $key }}"
                                                                    wire:model.defer="returnInvoiceDetails.{{ $key }}.amount"
                                                                    disabled
                                                                >
                                                            @else
                                                                @if(isset($returnDetail['amount']))
                                                                    {{ $returnDetail['amount'] }}
                                                                @endif
                                                            @endif
                                                        </td>

                                                        <!-- Action (Remove) -->
                                                        @if($isEditing)
                                                            <td>
                                                                <button
                                                                    type="button"
                                                                    class="btn btn-outline-danger btn-xs"
                                                                    wire:click="removeReturnInvoiceDetail({{ $key }})"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </td>
                                                        @endif
                                                    </tr>
                                                @endforeach

                                                <!-- Focus scripts -->
                                                <script>
                                                    function focusNextField(nextFieldId) {
                                                        document.getElementById(nextFieldId).focus();
                                                    }

                                                    function focusNextOnEnter(event, nextFieldId) {
                                                        if (event.key === 'Enter') {
                                                            event.preventDefault();
                                                            document.getElementById(nextFieldId).focus();
                                                        }
                                                    }
                                                </script>
                                            </tbody>
                                        </table>
                                    </div> <!-- /.table-responsive -->
                                </div>
                            </div>
                        </div>
                    </div> <!-- /.row -->

                    <!-- Totals Section -->
                    <div class="row mt-2">
                        <div class="col-md-12">
                            <div class="card">
                                <div class="card-body">
                                    <div class="row">
                                        <!-- Total Quantity -->
                                        <div class="col-md-1">
                                            <div class="form-group @error('total_quantity') has-error @enderror">
                                                <label for="total_quantity" class="control-label" style="font-size: 0.75rem;">
                                                    Units
                                                </label>
                                                <input
                                                    type="number"
                                                    class="form-control form-control-sm"
                                                    id="total_quantity"
                                                    name="total_quantity"
                                                    wire:model="total_quantity"
                                                    placeholder="0"
                                                    disabled
                                                >
                                                @error('total_quantity')
                                                    <span class="text-danger">{{ $message }}</span>
                                                @enderror
                                            </div>
                                        </div>

                                        <!-- Total Discount -->
                                        <div class="col-md-1">
                                            <div class="form-group @error('total_discount') has-error @enderror">
                                                <label for="total_discount" class="control-label" style="font-size: 0.75rem;">
                                                    Discount
                                                </label>
                                                <input
                                                    type="number"
                                                    class="form-control form-control-sm"
                                                    id="total_discount"
                                                    name="total_discount"
                                                    wire:model="total_discount"
                                                    placeholder="0.00"
                                                    disabled
                                                >
                                                @error('total_discount')
                                                    <span class="text-danger">{{ $message }}</span>
                                                @enderror
                                            </div>
                                        </div>

                                        <!-- Total Amount -->
                                        <div class="col-md-2">
                                            <div class="form-group @error('total_amount') has-error @enderror">
                                                <label for="total_amount" class="control-label" style="font-size: 0.75rem;">
                                                    Price Amount
                                                </label>
                                                <input
                                                    type="number"
                                                    class="form-control form-control-sm"
                                                    id="total_amount"
                                                    name="total_amount"
                                                    wire:model="total_amount"
                                                    placeholder="0.00"
                                                    disabled
                                                >
                                                @error('total_amount')
                                                    <span class="text-danger">{{ $message }}</span>
                                                @enderror
                                            </div>
                                        </div>

                                        <!-- Net Amount -->
                                        <div class="col-md-2">
                                            <div class="form-group @error('net_amount') has-error @enderror">
                                                <label for="net_amount" class="control-label" style="font-size: 0.75rem;">
                                                    Net Amount
                                                </label>
                                                <input
                                                    type="number"
                                                    class="form-control form-control-sm"
                                                    id="net_amount"
                                                    name="net_amount"
                                                    wire:model="net_amount"
                                                    placeholder="0.00"
                                                    disabled
                                                >
                                                @error('net_amount')
                                                    <span class="text-danger">{{ $message }}</span>
                                                @enderror
                                            </div>
                                        </div>

                                        <!-- Paid Amount -->
                                        <div class="col-md-2">
                                            <div class="form-group @error('paid_amount') has-error @enderror">
                                                <label for="paid_amount" class="control-label" style="font-size: 0.75rem;">
                                                    Paid Amount
                                                </label>
                                                <input
                                                    type="number"
                                                    class="form-control form-control-sm"
                                                    id="paid_amount"
                                                    name="paid_amount"
                                                    wire:model="paid_amount"
                                                    wire:blur="calculateDueAmount"
                                                    placeholder="0.00"
                                                    @if(!$isEditing) @endif disabled
                                                >
                                                @error('paid_amount')
                                                    <span class="text-danger">{{ $message }}</span>
                                                @enderror
                                            </div>
                                        </div>

                                        <!-- Due Amount -->
                                        <div class="col-md-2">
                                            <div class="form-group @error('due_amount') has-error @enderror">
                                                <label for="due_amount" class="control-label" style="font-size: 0.75rem;">
                                                    Due Amount
                                                </label>
                                                <input
                                                    type="number"
                                                    class="form-control form-control-sm"
                                                    id="due_amount"
                                                    name="due_amount"
                                                    wire:model="due_amount"
                                                    placeholder="0.00"
                                                    disabled
                                                >
                                                @error('due_amount')
                                                    <span class="text-danger">{{ $message }}</span>
                                                @enderror
                                            </div>
                                        </div>

                                        <!-- Action Buttons (Add, Cancel, Save, etc.) -->
                                        <div class="col-md-2">
                                            @if($isEditing)
                                                <label for="group_action" class="control-label" style="font-size: 0.75rem;">
                                                    Actions
                                                </label>
                                            @endif
                                            <div class="btn-group btn-group-justified" role="group">
                                                @if($isEditing)
                                                    @if(auth()->user()->can('pharmacy.returnsaleinvoice.add'))
                                                        <button
                                                            type="button"
                                                            class="btn btn-primary btn-sm"
                                                            id="add_item_button"
                                                            wire:click.prevent="addItem"
                                                            title="Add New Item"
                                                            wire:ignore
                                                        >
                                                            Add
                                                        </button>
                                                    @endif
                                                @endif

                                                @if($isStoring)
                                                    @if(auth()->user()->can('pharmacy.returnsaleinvoice.cancel'))
                                                        <button
                                                            type="button"
                                                            class="btn btn-secondary btn-sm"
                                                            id="cancel_button"
                                                            wire:click="cancel_store"
                                                            title="Cancel Store"
                                                            wire:ignore
                                                        >
                                                            Cancel
                                                        </button>
                                                    @endif

                                                    @if(auth()->user()->can('pharmacy.returnsaleinvoice.add'))
                                                        <button
                                                            type="button"
                                                            class="btn btn-success btn-sm"
                                                            id="save_button"
                                                            wire:click="store"
                                                            title="Store Record"
                                                            wire:ignore
                                                        >
                                                            Save
                                                        </button>
                                                    @endif
                                                @endif

                                                @if($isUpdating)
                                                    @if(auth()->user()->can('pharmacy.returnsaleinvoice.cancel'))
                                                        <button
                                                            type="button"
                                                            class="btn btn-secondary btn-sm"
                                                            id="cancel_button"
                                                            wire:click="cancel_update"
                                                            title="Cancel Update"
                                                            wire:ignore
                                                        >
                                                            Cancel
                                                        </button>
                                                    @endif

                                                    @if(auth()->user()->can('pharmacy.returnsaleinvoice.edit'))
                                                        <button
                                                            type="button"
                                                            class="btn btn-success btn-sm"
                                                            id="save_button"
                                                            wire:click="update"
                                                            title="Update Record"
                                                            wire:ignore
                                                        >
                                                            Save
                                                        </button>
                                                    @endif
                                                @endif
                                            </div>

                                            <!-- Keyboard Shortcuts -->
                                            <script>
                                                document.addEventListener('keydown', function(event) {
                                                    if (event.shiftKey && event.key === 'A') {
                                                        event.preventDefault();
                                                        const addBtn = document.getElementById('add_item_button');
                                                        if (addBtn) addBtn.click();
                                                    }
                                                });
                                                document.addEventListener('keydown', function(event) {
                                                    if (event.shiftKey && event.key === 'C') {
                                                        event.preventDefault();
                                                        const cancelBtn = document.getElementById('cancel_button');
                                                        if (cancelBtn) cancelBtn.click();
                                                    }
                                                });
                                                document.addEventListener('keydown', function(event) {
                                                    if (event.shiftKey && event.key === 'S') {
                                                        event.preventDefault();
                                                        const saveBtn = document.getElementById('save_button');
                                                        if (saveBtn) saveBtn.click();
                                                    }
                                                });
                                            </script>
                                        </div>
                                    </div> <!-- /.row -->
                                </div>
                            </div>
                        </div>
                    </div> <!-- /.row -->
                </form>
            </div> <!-- /.card-body -->
        </div> <!-- /.card -->

        <!-- Footer Section for Action Buttons (only if not editing) -->
        @if(!$isEditing)
            @if(
                auth()->user()->can('pharmacy.returnsaleinvoice.add') ||
                auth()->user()->can('pharmacy.returnsaleinvoice.edit') ||
                auth()->user()->can('pharmacy.returnsaleinvoice.search') ||
                auth()->user()->can('pharmacy.returnsaleinvoice.delete') ||
                auth()->user()->can('pharmacy.returnsaleinvoice.navigate') ||
                auth()->user()->can('pharmacy.returnsaleinvoice.view') ||
                auth()->user()->can('pharmacy.returnsaleinvoice.print')
            )
                <div class="col-md-12">
                    <div class="btn-group btn-group-justified" role="group" aria-label="Action Buttons" style="width: 100%;">
                        @if(auth()->user()->can('pharmacy.returnsaleinvoice.add'))
                            <button
                                id="btn-new"
                                type="button"
                                class="btn btn-outline-primary btn-icon-text btn-sm"
                                wire:click.prevent="new"
                                wire:ignore
                            >
                                <i class="btn-icon-prepend" data-feather="file-plus"></i>1.New
                            </button>
                        @endif

                        @if(auth()->user()->can('pharmacy.returnsaleinvoice.edit'))
                            <button
                                id="btn-edit"
                                type="button"
                                class="btn btn-outline-warning btn-icon-text btn-sm"
                                wire:click.prevent="edit"
                                wire:ignore
                            >
                                <i class="btn-icon-prepend" data-feather="edit"></i>2.Edit
                            </button>
                        @endif

                        @if(auth()->user()->can('pharmacy.returnsaleinvoice.search'))
                            <button
                                wire:click="search"
                                class="btn btn-outline-secondary btn-icon-text btn-sm"
                                data-bs-toggle="modal"
                                data-bs-target="#searchModal"
                                wire:ignore
                            >
                                <i class="btn-icon-prepend" data-feather="search"></i>3.Search
                            </button>
                        @endif

                        @if(auth()->user()->can('pharmacy.returnsaleinvoice.delete'))
                            <button
                                id="btn-delete"
                                type="button"
                                class="btn btn-outline-danger btn-icon-text btn-sm"
                                onclick="confirmDelete({{ $return_invoice_id }})"
                                wire:ignore
                            >
                                <i class="btn-icon-prepend" data-feather="trash-2"></i>4.Delete
                            </button>
                        @endif

                        @if(auth()->user()->can('pharmacy.returnsaleinvoice.navigate'))
                            <button
                                id="btn-previous"
                                type="button"
                                class="btn btn-outline-secondary btn-icon-text btn-sm"
                                wire:click.prevent="previous({{ $return_invoice_id }})"
                                wire:ignore
                            >
                                <i class="btn-icon-prepend" data-feather="arrow-left"></i>5.Previous
                            </button>
                            <button
                                id="btn-next"
                                type="button"
                                class="btn btn-outline-secondary btn-icon-text btn-sm"
                                wire:click.prevent="next({{ $return_invoice_id }})"
                                wire:ignore
                            >
                                <i class="btn-icon-prepend" data-feather="arrow-right"></i>6.Next
                            </button>
                        @endif

                        @if(auth()->user()->can('pharmacy.returnsaleinvoice.view'))
                            <button
                                id="btn-preview"
                                wire:click="preview"
                                class="btn btn-outline-info btn-icon-text btn-sm"
                                data-bs-toggle="modal"
                                data-bs-target="#modal"
                                wire:ignore
                            >
                                <i class="btn-icon-prepend" data-feather="eye"></i>7.Preview
                            </button>
                        @endif

                        @if(auth()->user()->can('pharmacy.returnsaleinvoice.print'))
                            <button
                                type="button"
                                id="printButton"
                                class="btn btn-outline-primary btn-icon-text btn-sm"
                                onclick="printPreview()"
                            >
                                <i class="btn-icon-prepend" data-feather="printer"></i>8.Print
                            </button>
                        @endif
                    </div>
                </div>

                <!-- Keyboard shortkeys for action buttons -->
                <script>
                    document.addEventListener('keydown', function(event) {
                        switch (event.key) {
                            case '1':
                                document.getElementById('btn-new')?.click();
                                break;
                            case '2':
                                document.getElementById('btn-edit')?.click();
                                break;
                            case '3':
                                document.getElementById('btn-search')?.click();
                                break;
                            case '4':
                                document.getElementById('btn-delete')?.click();
                                break;
                            case '5':
                                document.getElementById('btn-previous')?.click();
                                break;
                            case '6':
                                document.getElementById('btn-next')?.click();
                                break;
                            case '7':
                                document.getElementById('btn-preview')?.click();
                                break;
                            case '8':
                                document.getElementById('btn-print')?.click();
                                break;
                            case '9':
                                document.getElementById('btn-excel')?.click();
                                break;
                            case '0':
                                document.getElementById('btn-pdf')?.click();
                                break;
                        }
                    });
                </script>
            @endif
        @endif

        <!-- Search Modal -->
        <div
            wire:ignore.self
            class="modal fade"
            id="searchModal"
            tabindex="-1"
            role="dialog"
            aria-labelledby="modalLabel"
            aria-hidden="true"
        >
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <button
                            type="button"
                            class="btn-close"
                            data-bs-dismiss="modal"
                            aria-label="Close"
                            wire:click="closeModal()"
                        ></button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label for="purchase_info">Search Return Invoice</label>
                            <select
                                id="purchase_info"
                                class="form-control"
                                wire:change="fetchSelectedData($event.target.value)"
                            >
                                <option disabled selected>R.Inv No | Patient Name | Return Invoice Date</option>
                                @foreach ($showSearchData as $data)
                                    <option value="{{ $data['return_invoice_id'] }}">
                                        {{ $data['return_invoice_id'] }} |
                                        {{ $data['patient_name'] }} |
                                        {{ $data['return_invoice_date'] }}
                                    </option>
                                @endforeach
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div> <!-- /.Search Modal -->

        <!-- Preview Modal -->
        <div
            wire:ignore.self
            class="modal fade"
            id="modal"
            tabindex="-1"
            role="dialog"
            aria-labelledby="modalLabel"
            aria-hidden="true"
        >
            <div class="modal-dialog modal-fullscreen" role="document">
                <div class="modal-content" style="background-color: white; color: black;">
                    <div class="modal-header" style="background-color: white; color: black;">
                        <button
                            type="button"
                            class="btn-close"
                            data-bs-dismiss="modal"
                            aria-label="Close"
                            wire:click="closeModal()"
                            style="position: absolute; top: 10px; right: 10px;"
                        ></button>
                        <div class="w-100 text-center">
                            <h2>LIFE HEALTHCARE CENTER</h2>
                            <p>Abad Khak Chahar Rahe, Arzan Qemat, Kabul Afghanistan.</p>
                            <p>Office cell #: 0093 766 62 62 62</p>
                            <h3 class="mt-3">RETURN INVOICE</h3>
                        </div>
                    </div>

                    <div
                        class="modal-body"
                        style="background-color: white; color: black; max-height: 80vh; overflow-y: auto;"
                    >
                        <div
                            class="container"
                            style="width: 100%; font-family: Arial, sans-serif; padding: 20px; border: 1px solid #000;"
                        >
                            <!-- Company and Billing Info -->
                            <div class="row mt-4">
                                <div class="col-6">
                                    <p>
                                        Patient Name:
                                        <span style="font-size: 1.5em;">
                                            {{ strtoupper($previewData['patient_name'] ?? '') }}
                                        </span>
                                    </p>
                                    <p>Bill Number #: {{ $previewData['invoice_no'] ?? '' }}</p>
                                    <p>Bilty/Other #: {{ $previewData['bilty_no'] ?? '' }}</p>
                                </div>
                                <div class="col-6 text-end">
                                    <p>Serial #: {{ $previewData['invoice_no'] ?? '' }}</p>
                                    <p>Date: {{ $previewData['invoice_date'] ?? '' }}</p>
                                    <p>Currency: {{ $previewData['currency'] ?? '' }}</p>
                                </div>
                            </div>

                            <!-- Item Table -->
                            <div class="table-responsive">
                                <table class="table table-bordered mt-3 text-dark">
                                    <thead>
                                        <tr>
                                            <th class="text-dark fw-bold">Quantity</th>
                                            <th class="text-dark fw-bold">Bonus</th>
                                            <th class="text-dark fw-bold">Product Name</th>
                                            <th class="text-dark fw-bold">Batch #</th>
                                            <th class="text-dark fw-bold">Mfg. Date</th>
                                            <th class="text-dark fw-bold">Expiry</th>
                                            <th class="text-dark fw-bold">Price</th>
                                            <th class="text-dark fw-bold">Discount</th>
                                            <th class="text-dark fw-bold">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @foreach ($previewData['returnInvoiceDetails'] ?? [] as $detail)
                                            <tr>
                                                <td>{{ $detail['quantity'] ?? '' }}</td>
                                                <td>{{ $detail['bonus_quantity'] ?? '' }}</td>
                                                <td>{{ strtoupper($detail['product_name'] ?? '') }}</td>
                                                <td>{{ $detail['batch_no'] ?? '' }}</td>
                                                <td>{{ $detail['mfg_date'] ?? '' }}</td>
                                                <td>{{ $detail['expiry_date'] ?? '' }}</td>
                                                <td>{{ $detail['unit_price'] ?? '' }}</td>
                                                <td>{{ $detail['discount'] ?? '' }}</td>
                                                <td>{{ $detail['amount'] ?? '' }}</td>
                                            </tr>
                                        @endforeach
                                    </tbody>
                                </table>
                            </div>

                            <!-- Totals Section -->
                            <div class="row mt-4">
                                <div class="col-3">
                                    <p>Units: {{ $previewData['total_quantity'] ?? '' }}</p>
                                    <p>No of item(s): {{ count($previewData['returnInvoiceDetails'] ?? []) }}</p>
                                </div>
                                <div class="col-5 text-end"></div>
                                <div class="col-4 text-end">
                                    <p>Total Amount: {{ number_format($previewData['total_amount'] ?? 0, 2) }}</p>
                                    <p>Total Discount: {{ number_format($previewData['total_discount'] ?? 0, 2) }}</p>
                                    <p>Net Total: {{ number_format($previewData['net_amount'] ?? 0, 2) }}</p>
                                    <p>Paid Amount: {{ number_format($previewData['paid_amount'] ?? 0, 2) }}</p>
                                    <p>Final Balance: {{ number_format($previewData['due_amount'] ?? 0, 2) }}</p>
                                </div>
                            </div>

                            <!-- Remarks Section -->
                            <div class="mt-4">
                                <p>Remarks:</p>
                                <div style="border: 1px solid #000; height: 60px;"></div>
                            </div>

                            <!-- Footer Section -->
                            <div class="row mt-4">
                                <div class="col-6 text-start">
                                    <p>User: {{ auth()->user()->name }}</p>
                                </div>
                                <div class="col-6 text-end">
                                    <p>Print Date: {{ now()->setTimezone('Asia/Kabul')->format('d-m-Y H:i:s A') }}</p>
                                </div>
                            </div>
                        </div> <!-- /.container -->
                    </div> <!-- /.modal-body -->
                </div> <!-- /.modal-content -->
            </div> <!-- /.modal-dialog -->
        </div> <!-- /.Preview Modal -->

        <!-- Custom Search Styles -->
        <style>
            #purchase_info {
                font-family: monospace; /* Use a fixed-width font */
            }
            #purchase_info option {
                display: flex;
                justify-content: space-between;
            }
            .purchase-no {
                display: inline-block;
                width: 100px; /* Adjust as needed */
            }
            .patient-name {
                display: inline-block;
                width: 150px; /* Adjust as needed */
            }
            .purchase-date {
                display: inline-block;
                width: 100px; /* Adjust as needed */
            }
        </style>

        <!-- Custom Print Styles -->
        <style>
            @media print {
                body {
                    -webkit-print-color-adjust: exact;
                }
                .modal-content {
                    width: 100%;
                    max-width: 100%;
                    margin: 0;
                    padding: 0;
                }
                .container {
                    width: 100%;
                    max-width: 100%;
                    margin: 0;
                    padding: 0;
                }
                .table {
                    width: 100%;
                    max-width: 100%;
                    margin: 0;
                    padding: 0;
                }
                .table th,
                .table td {
                    padding: 5px;
                    font-size: 12px;
                }
                .table th {
                    background-color: #f2f2f2;
                }
                .modal-header,
                .modal-body,
                .modal-footer {
                    padding: 10px;
                }
                .modal-header h2,
                .modal-header h3,
                .modal-header p {
                    margin: 0;
                    padding: 0;
                }
                .modal-body {
                    padding: 10px;
                }
                .modal-footer {
                    padding: 10px;
                }
                .row {
                    page-break-inside: avoid;
                }
                .table-responsive {
                    page-break-inside: avoid;
                }
            }
        </style>

        <script>
            function confirmDelete(returnInvoiceNo) {
                if (confirm('Are you sure you want to delete this record?')) {
                    @this.call('delete', returnInvoiceNo);
                }
            }

            function focusNextField(nextFieldId) {
                document.getElementById(nextFieldId).focus();
            }

            function printPreview() {
                // Call the Livewire method to generate the preview data
                @this.call('preview');

                // Add a small delay to ensure the preview data is fetched before printing
                setTimeout(() => {
                    // Get the preview data from Livewire
                    const previewContent = @this.previewData;

                    const totalAmount   = parseFloat(previewContent.total_amount)   || 0;
                    const totalDiscount = parseFloat(previewContent.total_discount) || 0;
                    const netAmount     = parseFloat(previewContent.net_amount)     || 0;
                    const paidAmount    = parseFloat(previewContent.paid_amount)    || 0;
                    const dueAmount     = parseFloat(previewContent.due_amount)     || 0;

                    // Create a new window to print the preview
                    const printWindow = window.open('', '', 'width=400,height=600');
                    printWindow.document.write(`
                        <html>
                            <head>
                                <title>Print Preview</title>
                                <style>
                                    body {
                                        font-family: Arial, sans-serif;
                                        font-size: 10px;
                                        color: #000;
                                        margin: 0;
                                        padding: 0;
                                        width: 72mm;
                                    }
                                    .container {
                                        width: 100%;
                                        margin: 0;
                                        padding: 5px;
                                        box-sizing: border-box;
                                    }
                                    h2, h3, p {
                                        text-align: center;
                                        margin: 2px 0;
                                    }
                                    h2 {
                                        font-size: 1.2em;
                                    }
                                    h3 {
                                        font-size: 1em;
                                    }
                                    .info-table {
                                        margin: 0;
                                        padding: 0;
                                        width: 100%;
                                        font-size: 10px;
                                    }
                                    .info-table td {
                                        vertical-align: top;
                                    }
                                    .table {
                                        width: 100%;
                                        border-collapse: collapse;
                                    }
                                    .table th, .table td {
                                        text-align: left;
                                    }
                                    .totals {
                                        margin-top: 10px;
                                        font-weight: bold;
                                        text-align: right;
                                    }
                                    .remarks {
                                        margin-top: 10px;
                                        padding: 5px;
                                        border-top: 1px dashed #000;
                                        font-size: 10px;
                                        text-align: left;
                                    }
                                    .footer {
                                        margin-top: 10px;
                                        text-align: center;
                                        font-size: 9px;
                                        border-top: 1px dashed #000;
                                        padding-top: 5px;
                                    }
                                    @page {
                                        size: 80mm auto;
                                        margin: 0;
                                    }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <p><strong>LIFE HEALTHCARE CENTER</strong></p>
                                    <p><small>Office cell #: 0093 766 62 62 62</small></p>
                                    <p>RETURN INVOICE RECEIPT</p>

                                    <div class="info-table">
                                        <table>
                                            <tr>
                                                <td><small>Patient:</small></td>
                                                <td>${previewContent.patient_name || 'N/A'}</td>
                                            </tr>
                                            <tr>
                                                <td><small>Bill #:</small></td>
                                                <td>${previewContent.invoice_no || 'N/A'}</td>
                                            </tr>
                                            <tr>
                                                <td><small>Date:</small></td>
                                                <td>${previewContent.invoice_date || 'N/A'}</td>
                                            </tr>
                                        </table>
                                    </div>

                                    <table class="table">
                                        <thead>
                                            <tr>
                                                <th><small>Item</small></th>
                                                <th><small>Qty</small></th>
                                                <th><small>Price</small></th>
                                                <th><small>Amt</small></th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${(previewContent.returnInvoiceDetails || []).map(detail => `
                                                <tr>
                                                    <td><small>${detail.product_name || 'N/A'}</small></td>
                                                    <td><small>${detail.quantity || 0}</small></td>
                                                    <td><small>${detail.unit_price || 0}</small></td>
                                                    <td><small>${detail.amount || 0}</small></td>
                                                </tr>
                                            `).join('')}
                                        </tbody>
                                    </table>

                                    <div class="totals">
                                        <p>Total Discount: ${totalDiscount.toFixed(2)}</p>
                                        <p>Net Amount: ${netAmount.toFixed(2)}</p>
                                        <p>Paid Amount: ${paidAmount.toFixed(2)}</p>
                                        <p>Due Amount: ${dueAmount.toFixed(2)}</p>
                                    </div>

                                    <div class="remarks">
                                        Remarks: (if any)
                                    </div>

                                    <div class="footer">
                                        <p>User: {{ auth()->user()->name }}</p>
                                        <p>Print Date: {{ now()->setTimezone("Asia/Kabul")->format("d-m-Y H:i:s A") }}</p>
                                        <p>Thank you for your business!</p>
                                    </div>
                                </div>
                            </body>
                        </html>
                    `);
                    printWindow.document.close();
                    printWindow.print();
                }, 500);
            }
        </script>

        <script>
            document.getElementById('purchase_info')?.addEventListener('change', function() {
                @this.fetchSelectedData(this.value);
            });

            // Listen for the 'close-modal' event from Livewire
            window.addEventListener('close-modal', function() {
                // Hide the search modal using Bootstrap's modal function
                var modalElement = document.getElementById('searchModal');
                var modalInstance = bootstrap.Modal.getInstance(modalElement);
                if (modalInstance) {
                    modalInstance.hide();
                }
            });
        </script>
    </div> <!-- /.container -->
</div> <!-- /.container-fluid -->
