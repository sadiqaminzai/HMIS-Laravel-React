<div class="container-fluid">
    <div class="container">
        <div class="card">
            <!-- Card Header: Purchase Invoice -->
            <div class="card-header">
                <h4>Purchase invoice</h4>
            </div>
            <div class="card-body">
                <form wire:submit.prevent="store">
                    <!-- Header Section for Purchase Information -->
                    <div class="purchase-general-info">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="form-group @error('supplier_id') has-error @enderror">
                                    @if($isChangesEnabled)
                                    <select class="form-control form-control-sm"
                                        id="supplier_id"
                                        name="supplier_id"
                                        wire:model="supplier_id"
                                        wire:change="fetchStackholderDetails">
                                        <option value="">--SELECT SUPPLIER--</option>
                                        @foreach($suppliers as $supplier)
                                        <option value="{{ $supplier->id }}">{{ strtoupper($supplier->name) }}</option>
                                        @endforeach
                                    </select>
                                    @error('supplier_id') <span class="text-danger">{{ $message }}</span> @enderror
                                    @else
                                    @foreach($suppliers as $supplier)
                                    @if($supplier->id == $supplier_id)
                                    <div class="row">
                                        <div class="col-md-3 text-info">Supplier Name:</div>
                                        <div class="col-md-9">{{ strtoupper($supplier->name) }}</div>
                                    </div> @endif
                                    @endforeach
                                    @endif
                                </div>
                                <div class="form-group @error('supplier_id') has-error @enderror">
                                </div>
                            </div>
                            <div class="col-md-2"></div>
                            <div class="col-md-2">
                                <div class="form-group @error('purchase_no') has-error @enderror">
                                    <input type="text" class="form-control form-control-sm" id="purchase_no" name="purchase_no" wire:model="purchase_no" placeholder="Purchase No" disabled>
                                    @error('purchase_no') <span class="text-danger">{{ $message }}</span> @enderror
                                </div>
                            </div>
                            <div class="col-md-2">
                                <div class="form-group @error('purchase_date') has-error @enderror">
                                    <input type="date" class="form-control form-control-sm" id="purchase_date" name="purchase_date" wire:model="purchase_date" @if(!$isEditing) disabled @endif>
                                    @error('purchase_date') <span class="text-danger">{{ $message }}</span> @enderror
                                </div>
                            </div>
                        </div>

                        <div class="row">
                            <div class="col-md-6">
                                <div class="row">
                                    <div class="col-md-3 text-info">Phone:</div>
                                    <div class="col-md-9 justify-content-start">{{ $supplier_phone }}</div>
                                </div>
                            </div>
                            <div class="col-md-4"></div>
                            <div class="col-md-2">
                                <div class="form-group @error('bilty_no') has-error @enderror">
                                    <input type="text" class="form-control form-control-sm" id="bilty_no" name="bilty_no" wire:model="bilty_no" placeholder="Billty No" @if(!$isEditing) disabled @endif>
                                    @error('bilty_no') <span class="text-danger">{{ $message }}</span> @enderror
                                </div>
                            </div>
                        </div>

                        <div class="row">
                            <div class="col-md-6">
                                <div class="row">
                                    <div class="col-md-3 text-info">Address:</div>
                                    <div class="col-md-9">{{ strtoupper($supplier_address) }}</div>
                                </div>
                            </div>
                            <div class="col-md-4"></div>
                            <div class="col-md-2">
                                <div class="form-group @error('invoice_no') has-error @enderror">
                                    <input type="text" class="form-control form-control-sm" id="invoice_no" name="invoice_no" wire:model="invoice_no" placeholder="Invoice#" @if(!$isEditing) disabled @endif>
                                    @error('invoice_no') <span class="text-danger">{{ $message }}</span> @enderror
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Body Section for Purchase Information -->
                    <div class="row mt-2">
                        <div class="col-md-12">
                            <div class="card">
                                <div class="card-body">
                                    <div class="table-responsive" style="min-height: 196px; max-height: 196px; overflow-y: auto;">
                                        <table class="table table-bordered table-hover" style="border-spacing: 0; border-collapse: collapse;">
                                            <thead class="mb-2">
                                                <tr>
                                                    <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Product Name</th>
                                                    <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Cost Price</th>
                                                    <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Batch No</th>
                                                    <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Mfg. Date</th>
                                                    <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Expiry</th>
                                                    <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Quantity</th>
                                                    <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Bonus</th>
                                                    <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Discount</th>
                                                    <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Amount (AFN)</th>
                                                    @if($isEditing)
                                                    <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Action</th>
                                                    @endif
                                                </tr>
                                            </thead>

                                            <tbody>
                                                @foreach ($purchaseDetails as $key => $purchaseDetail)
                                                <tr>
                                                    <td>
                                                        <div class="form-group @error('supplier_id') has-error @enderror">
                                                            @if($isChangesEnabled)
                                                            <select class="form-control form-control-sm"
                                                                id="product_id.{{ $key }}"
                                                                name="product_id.{{ $key }}"
                                                                wire:model="purchaseDetails.{{ $key }}.product_id"
                                                                wire:change="fetchProductDetails({{ $key }})"
                                                                onchange="focusNextField('unit_price.{{ $key }}')">
                                                                <option value="">--Select--</option>
                                                                @foreach($products as $product)
                                                                <option value="{{ $product->id }}">{{ strtoupper($product->name) }}</option>
                                                                @endforeach
                                                            </select>
                                                            @else
                                                            @foreach($products as $product)
                                                            @if($product->id == ($purchaseDetails[$key]['product_id'] ?? null))
                                                            {{ strtoupper($product->name) }}
                                                            @endif
                                                            @endforeach
                                                            @endif
                                                        </div>
                                                    </td>
                                                    <td>
                                                        @if($isChangesEnabled)
                                                        <input type="text" class="form-control form-control-sm"
                                                            id="unit_price.{{ $key }}"
                                                            name="unit_price.{{ $key }}"
                                                            wire:model.defer="purchaseDetails.{{ $key }}.unit_price"
                                                            onkeydown="focusNextOnEnter(event, 'batch_no.{{ $key }}')">
                                                        @else
                                                        @if(isset($purchaseDetails[$key]['unit_price']))
                                                        {{ strtoupper($purchaseDetails[$key]['unit_price']) }}
                                                        @endif
                                                        @endif
                                                    </td>
                                                    <td>
                                                        @if($isChangesEnabled)
                                                        <input type="text" class="form-control form-control-sm"
                                                            id="batch_no.{{ $key }}"
                                                            name="batch_no.{{ $key }}"
                                                            wire:model.defer="purchaseDetails.{{ $key }}.batch_no"
                                                            autocomplete="off"
                                                            onkeydown="focusNextOnEnter(event, 'mfg_date.{{ $key }}')">
                                                        @else
                                                        @if(isset($purchaseDetails[$key]['batch_no']))
                                                        {{ strtoupper($purchaseDetails[$key]['batch_no']) }}
                                                        @endif
                                                        @endif
                                                    </td>
                                                    <td>
                                                        @if($isChangesEnabled)
                                                        <input type="date" class="form-control form-control-sm"
                                                            id="mfg_date.{{ $key }}"
                                                            name="mfg_date.{{ $key }}"
                                                            wire:model.defer="purchaseDetails.{{ $key }}.mfg_date"
                                                            onkeydown="focusNextOnEnter(event, 'expiry_date.{{ $key }}')">
                                                        @else
                                                        @if(isset($purchaseDetails[$key]['mfg_date']))
                                                        {{ $purchaseDetails[$key]['mfg_date'] }}
                                                        @endif
                                                        @endif
                                                    </td>
                                                    <td>
                                                        @if($isChangesEnabled)
                                                        <input type="date" class="form-control form-control-sm"
                                                            id="expiry_date.{{ $key }}"
                                                            name="expiry_date.{{ $key }}"
                                                            wire:model.defer="purchaseDetails.{{ $key }}.expiry_date"
                                                            onkeydown="focusNextOnEnter(event, 'quantity.{{ $key }}')">
                                                        @else
                                                        @if(isset($purchaseDetails[$key]['mfg_date']))
                                                        {{ $purchaseDetails[$key]['mfg_date'] }}
                                                        @endif
                                                        @endif
                                                    </td>
                                                    <td>
                                                        @if($isChangesEnabled)
                                                        <input type="text" class="form-control form-control-sm"
                                                            id="quantity.{{ $key }}"
                                                            name="quantity.{{ $key }}"
                                                            wire:model.lazy="purchaseDetails.{{ $key }}.quantity"
                                                            min="0"
                                                            wire:blur="calculateItemAmount({{ $key }})"
                                                            oninput="this.value = this.value.replace(/[^0-9]/g, '');"
                                                            autocomplete="off"
                                                            onkeydown="focusNextOnEnter(event, 'bonus_quantity.{{ $key }}')">
                                                        @else
                                                        @if(isset($purchaseDetails[$key]['quantity']))
                                                        {{ $purchaseDetails[$key]['quantity'] }}
                                                        @endif
                                                        @endif
                                                    </td>
                                                    <td>
                                                        @if($isChangesEnabled)
                                                        <input type="text" class="form-control form-control-sm"
                                                            id="bonus_quantity.{{ $key }}"
                                                            name="bonus_quantity.{{ $key }}"
                                                            wire:model.defer="purchaseDetails.{{ $key }}.bonus_quantity"
                                                            min="0"
                                                            oninput="this.value = this.value.replace(/[^0-9]/g, '');"
                                                            autocomplete="off"
                                                            onkeydown="focusNextOnEnter(event, 'discount.{{ $key }}')">
                                                        @else
                                                        @if(isset($purchaseDetails[$key]['bonus_quantity']))
                                                        {{ $purchaseDetails[$key]['bonus_quantity'] }}
                                                        @endif
                                                        @endif
                                                    </td>
                                                    <td>
                                                        @if($isChangesEnabled)
                                                        <input type="text" class="form-control form-control-sm"
                                                            id="discount.{{ $key }}"
                                                            name="discount.{{ $key }}"
                                                            wire:model.lazy="purchaseDetails.{{ $key }}.discount"
                                                            min="0"
                                                            wire:blur="calculateItemAmount({{ $key }})"
                                                            oninput="this.value = this.value.replace(/[^0-9]/g, '');"
                                                            autocomplete="off">
                                                        @else
                                                        @if(isset($purchaseDetails[$key]['discount']))
                                                        {{ $purchaseDetails[$key]['discount'] }}
                                                        @endif
                                                        @endif
                                                    </td>
                                                    <td>
                                                        @if($isChangesEnabled)
                                                        <input type="number" class="form-control form-control-sm"
                                                            id="amount.{{ $key }}"
                                                            name="amount.{{ $key }}"
                                                            wire:model.defer="purchaseDetails.{{ $key }}.amount"
                                                            disabled>
                                                        @else
                                                        @if(isset($purchaseDetails[$key]['amount']))
                                                        {{ $purchaseDetails[$key]['amount'] }}
                                                        @endif
                                                        @endif
                                                    </td>
                                                    @if($isEditing)
                                                    <td>
                                                        <button type="button" class="btn btn-outline-danger btn-xs" wire:click="removePurchaseDetail({{ $key }})">Remove</button>
                                                    </td>
                                                    @endif
                                                </tr>
                                                @endforeach

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
                                    </div>

                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Totals Section -->
                    <div class="row mt-2">
                        <div class="col-md-12">
                            <div class="card">
                                <div class="card-body">
                                    <div class="row">
                                        <!-- Total Quantity -->
                                        <div class="col-md-1">
                                            <div class="form-group @error('total_quantity') has-error @enderror">
                                                <label for="total_quantity" class="control-label" style="font-size: 0.75rem;">Units</label>
                                                <input type="number" class="form-control form-control-sm" id="total_quantity" name="total_quantity" wire:model="total_quantity" placeholder="0" disabled>
                                                @error('total_quantity') <span class="text-danger">{{ $message }}</span> @enderror
                                            </div>
                                        </div>
                                        <!-- Total Discount -->
                                        <div class="col-md-1">
                                            <div class="form-group @error('total_discount') has-error @enderror">
                                                <label for="total_discount" class="control-label" style="font-size: 0.75rem;">Discount</label>
                                                <input type="number" class="form-control form-control-sm" id="total_discount" name="total_discount" wire:model="total_discount" placeholder="0.00" disabled>
                                                @error('total_discount') <span class="text-danger">{{ $message }}</span> @enderror
                                            </div>
                                        </div>
                                        <!-- Total Amount -->
                                        <div class="col-md-2">
                                            <div class="form-group @error('total_amount') has-error @enderror">
                                                <label for="total_amount" class="control-label" style="font-size: 0.75rem;">Price Amount</label>
                                                <input type="number" class="form-control form-control-sm" id="total_amount" name="total_amount" wire:model="total_amount" placeholder="0.00" disabled>
                                                @error('total_amount') <span class="text-danger">{{ $message }}</span> @enderror
                                            </div>
                                        </div>
                                        <!-- Net Amount -->
                                        <div class="col-md-2">
                                            <div class="form-group @error('net_amount') has-error @enderror">
                                                <label for="net_amount" class="control-label" style="font-size: 0.75rem;">Net Amount</label>
                                                <input type="number" class="form-control form-control-sm" id="net_amount" name="net_amount" wire:model="net_amount" placeholder="0.00" disabled>
                                                @error('net_amount') <span class="text-danger">{{ $message }}</span> @enderror
                                            </div>
                                        </div>
                                        <!-- Paid Amount -->
                                        <div class="col-md-2">
                                            <div class="form-group @error('paid_amount') has-error @enderror">
                                                <label for="paid_amount" class="control-label" style="font-size: 0.75rem;">Paid Amount</label>
                                                <input type="number" class="form-control form-control-sm" id="paid_amount" name="paid_amount" wire:model="paid_amount" wire:blur="calculateDueAmount" placeholder="0.00" @if(!$isEditing) disabled @endif>
                                                @error('paid_amount') <span class="text-danger">{{ $message }}</span> @enderror
                                            </div>
                                        </div>
                                        <!-- Due Amount -->
                                        <div class="col-md-2">
                                            <div class="form-group @error('due_amount') has-error @enderror">
                                                <label for="due_amount" class="control-label" style="font-size: 0.75rem;">Due Amount</label>
                                                <input type="number" class="form-control form-control-sm" id="due_amount" name="due_amount" wire:model="due_amount" placeholder="0.00" disabled>
                                                @error('due_amount') <span class="text-danger">{{ $message }}</span> @enderror
                                            </div>
                                        </div>
                                        <div class="col-md-2">
                                            @if($isEditing)
                                            <label for="group_action" class="control-label" style="font-size: 0.75rem;">Actions</label>
                                            @endif
                                            <div class="btn-group btn-group-justified" role="group">
                                                @if($isEditing)
                                                @if(auth()->user()->can('pharmacy.purchase.add'))
                                                <button type="button" class="btn btn-primary btn-sm" id="add_item_button" wire:click.prevent="addItem" title="Add New Item" wire:ignore>Add</button>
                                                @endif
                                                @endif
                                                @if($isStoring)
                                                    @if(auth()->user()->can('pharmacy.purchase.cancel'))
                                                    <button type="button" class="btn btn-secondary btn-sm" id="cancel_button" wire:click="cancel_store" title="Cancel Store" wire:ignore>Cancel</button>
                                                    @endif
                                                    @if(auth()->user()->can('pharmacy.purchase.store'))
                                                    <button type="button" class="btn btn-success btn-sm" id="save_button" wire:click="{{'store'}}" title="Store Record" wire:ignore>Save</button>
                                                    @endif
                                                @endif
                                                @if($isUpdating)
                                                    @if(auth()->user()->can('pharmacy.purchase.cancel'))
                                                    <button type="button" class="btn btn-secondary btn-sm" id="cancel_button" wire:click="cancel_update" title="Cancel Update" wire:ignore>Cancel</button>
                                                    @endif
                                                    @if(auth()->user()->can('pharmacy.purchase.update'))
                                                    <button type="button" class="btn btn-success btn-sm" id="save_button" wire:click="{{'update'}}" title="Update Record" wire:ignore>Save</button>
                                                    @endif
                                                @endif
                                            </div>

                                            <script>
                                                document.addEventListener('keydown', function(event) {
                                                    if (event.shiftKey && event.key === 'A') {
                                                        event.preventDefault();
                                                        document.getElementById('add_item_button').click();
                                                    }
                                                });
                                                document.addEventListener('keydown', function(event) {
                                                    if (event.shiftKey && event.key === 'C') {
                                                        event.preventDefault();
                                                        document.getElementById('cancel_button').click();
                                                    }
                                                });
                                                document.addEventListener('keydown', function(event) {
                                                    if (event.shiftKey && event.key === 'S') {
                                                        event.preventDefault();
                                                        document.getElementById('save_button').click();
                                                    }
                                                });
                                            </script>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                </form>
            </div>
        </div>

        <!-- Footer Section for Action Buttons -->
        @if(!$isEditing)
        @if(
        auth()->user()->can('pharmacy.purchase.add') ||
        auth()->user()->can('pharmacy.purchase.edit') ||
        auth()->user()->can('pharmacy.purchase.search') ||
        auth()->user()->can('pharmacy.purchase.delete') ||
        auth()->user()->can('pharmacy.purchase.navigate') ||
        auth()->user()->can('pharmacy.purchase.view') ||
        auth()->user()->can('pharmacy.purchase.print') ||
        auth()->user()->can('pharmacy.purchase.export_excel') ||
        auth()->user()->can('pharmacy.purchase.export_pdf')
        )
        <div class="col-md-12">
            <div class="btn-group btn-group-justified" role="group" aria-label="Action Buttons" style="width: 100%;">
                @if(auth()->user()->can('pharmacy.purchase.add'))
                <button id="btn-new" type="button" class="btn btn-outline-primary btn-icon-text btn-sm" wire:click.prevent="new" wire:ignore>
                    <i class="btn-icon-prepend" data-feather="file-plus"></i>1.New
                </button>
                @endif

                @if(auth()->user()->can('pharmacy.purchase.edit'))
                <button id="btn-edit" type="button" class="btn btn-outline-warning btn-icon-text btn-sm" wire:click.prevent="edit" wire:ignore>
                    <i class="btn-icon-prepend" data-feather="edit"></i>2.Edit
                </button>
                @endif

                @if(auth()->user()->can('pharmacy.purchase.search'))
                <button wire:click="search" class="btn btn-outline-secondary btn-icon-text btn-sm" data-bs-toggle="modal" data-bs-target="#searchModal" wire:ignore>
                    <i class="btn-icon-prepend" data-feather="search"></i>3.Search
                </button>
                @endif

                @if(auth()->user()->can('pharmacy.purchase.delete'))
                <button id="btn-delete" type="button" class="btn btn-outline-danger btn-icon-text btn-sm" onclick="confirmDelete({{ $purchase_no }})" wire:ignore>
                    <i class="btn-icon-prepend" data-feather="trash-2"></i>4.Delete
                </button>
                @endif

                @if(auth()->user()->can('pharmacy.purchase.navigate'))
                <button id="btn-previous" type="button" class="btn btn-outline-secondary btn-icon-text btn-sm" wire:click.prevent="previous({{ $purchase_no }})" wire:ignore>
                    <i class="btn-icon-prepend" data-feather="arrow-left"></i>5.Previous
                </button>
                <button id="btn-next" type="button" class="btn btn-outline-secondary btn-icon-text btn-sm" wire:click.prevent="next({{ $purchase_no }})" wire:ignore>
                    <i class="btn-icon-prepend" data-feather="arrow-right"></i>6.Next
                </button>
                @endif

                @if(auth()->user()->can('pharmacy.purchase.view'))
                <button id="btn-preview" wire:click="preview" class="btn btn-outline-info btn-icon-text btn-sm" data-bs-toggle="modal" data-bs-target="#modal" wire:ignore>
                    <i class="btn-icon-prepend" data-feather="eye"></i>7.Preview
                </button>
                @endif

                @if(auth()->user()->can('pharmacy.purchase.print'))
                <button type="button" id="printButton" class="btn btn-outline-primary btn-icon-text btn-sm" onclick="printPreview()">
                    <i class="btn-icon-prepend" data-feather="printer"></i>8.Print
                </button>
                @endif

                @if(auth()->user()->can('pharmacy.purchase.export_excel'))
                <button id="btn-excel" type="button" class="btn btn-outline-success btn-icon-text btn-sm" wire:click.prevent="exportToExcel" wire:ignore>
                    <i class="btn-icon-prepend" data-feather="file"></i>9.Excel
                </button>
                @endif

                @if(auth()->user()->can('pharmacy.purchase.export_pdf'))
                <button id="btn-pdf" type="button" class="btn btn-outline-danger btn-icon-text btn-sm" wire:click.prevent="exportToPDF" wire:ignore>
                    <i class="btn-icon-prepend" data-feather="file-text"></i>10.PDF
                </button>
                @endif
            </div>
        </div>

        <script>
            document.addEventListener('keydown', function(event) {
                switch (event.key) {
                    case '1':
                        document.getElementById('btn-new').click();
                        break;
                    case '2':
                        document.getElementById('btn-edit').click();
                        break;
                    case '3':
                        document.getElementById('btn-search').click();
                        break;
                    case '4':
                        document.getElementById('btn-delete').click();
                        break;
                    case '5':
                        document.getElementById('btn-previous').click();
                        break;
                    case '6':
                        document.getElementById('btn-next').click();
                        break;
                    case '7':
                        document.getElementById('btn-preview').click();
                        break;
                    case '8':
                        document.getElementById('btn-print').click();
                        break;
                    case '9':
                        document.getElementById('btn-excel').click();
                        break;
                    case '0':
                        document.getElementById('btn-pdf').click();
                        break;
                }
            });
        </script>
        @endif

        @endif

        <!-- Search Modal -->
         <!-- Search Modal -->
         <div wire:ignore.self class="modal fade" id="searchModal" tabindex="-1" role="dialog" aria-labelledby="modalLabel" aria-hidden="true">
            <div class="modal-dialog" role="document">
                <div class="modal-content">
                    <div class="modal-header">
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeModal()"></button>
                    </div>

                    <div class="modal-body">
                        <div class="form-group">
                            <label for="purchase_info">Search Purchase</label>
                            <select id="purchase_info" class="form-control" wire:change="fetchSelectedData($event.target.value)">
                                <option disabled selected>Purchase No | Supplier Name | Purchase Date</option>
                                @foreach ($showSearchData as $data)
                                    <option value="{{ $data['purchase_no'] }}">
                                        {{ $data['purchase_no'] }} | {{ $data['supplier_name'] }} | {{ $data['purchase_date'] }}
                                    </option>
                                @endforeach
                            </select>
                        </div>
                    </div>

                </div>
            </div>
        </div>

        <!-- Preview Modal -->
        <div wire:ignore.self class="modal fade" id="modal" tabindex="-1" role="dialog" aria-labelledby="modalLabel" aria-hidden="true">
            <div class="modal-dialog modal-fullscreen" role="document"> <!-- Added modal-fullscreen class for full width -->
                <div class="modal-content" style="background-color: white; color: black;">
                    <div class="modal-header" style="background-color: white; color: black;">
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeModal()" style="position: absolute; top: 10px; right: 10px;"></button>
                        <div class="w-100 text-center">
                            <h2>LIFE HEALTHCARE CENTER</h2>
                            <p>Abad Khak Chahar Rahe, Arzan Qemat, Kabul Afghanistan.</p>
                            <p>Office cell #: 0093 766 62 62 62</p>
                            <h3 class="mt-3">PURCHASE</h3>
                        </div>
                    </div>

                    <div class="modal-body" style="background-color: white; color: black; max-height: 80vh; overflow-y: auto;">
                        <div class="container" style="width: 100%; font-family: Arial, sans-serif; padding: 20px; border: 1px solid #000;">
                            <!-- Company and Billing Info -->
                            <div class="row mt-4">
                                <div class="col-6">
                                    <p>Supplier Name: <span style="font-size: 1.5em;">{{ strtoupper($previewData['supplier_name'] ?? '') }}</span></p>
                                    <p>Bill Number #: {{ $previewData['invoice_no'] ?? '' }}</p>
                                    <p>Bilty/Other #: {{ $previewData['bilty_no'] ?? '' }}</p>
                                </div>
                                <div class="col-6 text-end">
                                    <p>Serial #: {{ $previewData['purchase_no'] ?? '' }}</p>
                                    <p>Date: {{ $previewData['purchase_date'] ?? '' }}</p>
                                    <p>Currency: {{ $previewData['currency'] ?? '' }}</p>
                                </div>
                            </div>

                            <!-- Item Table -->
                            <div class="table-responsive">
                                <table class="table table-bordered mt-3 text-dark">
                                    <thead>
                                        <tr>
                                            <th class="text-dark fw-bold">Quantity</th>
                                            <th class="text-dark fw-bold">Bon</th>
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
                                        @foreach ($previewData['purchaseDetails'] ?? [] as $detail)
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
                                    <p>No of item(s): {{ count($previewData['purchaseDetails'] ?? []) }}</p>
                                </div>
                                <div class="col-5 text-end">
                                    <br><br><br><br>
                                </div>
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
                        </div>
                    </div>
                </div>
            </div>
        </div>



        <!-- Custom Search Styles -->
        <style>
            #purchase_info {
                font-family: monospace;
                /* Use a fixed-width font */
            }

            #purchase_info option {
                display: flex;
                justify-content: space-between;
            }

            .purchase-no {
                display: inline-block;
                width: 100px;
                /* Adjust width as needed */
            }

            .supplier-name {
                display: inline-block;
                width: 150px;
                /* Adjust width as needed */
            }

            .purchase-date {
                display: inline-block;
                width: 100px;
                /* Adjust width as needed */
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
            function confirmDelete(purchaseNo) {
                if (confirm('Are you sure you want to delete this record?')) {
                    @this.call('delete', purchaseNo);
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

        // Ensure that the previewContent is valid and numbers are parsed properly
        const totalAmount = parseFloat(previewContent.total_amount) || 0;
        const totalDiscount = parseFloat(previewContent.total_discount) || 0;
        const netAmount = parseFloat(previewContent.net_amount) || 0;
        const paidAmount = parseFloat(previewContent.paid_amount) || 0;
        const dueAmount = parseFloat(previewContent.due_amount) || 0;

        // Create a new window to print the preview
        const printWindow = window.open('', '', 'width=800,height=600');
        printWindow.document.write(`
           <html>
    <head>
        <title>Print Preview</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                color: #333;
                margin: 0;
                padding: 0;
            }

            .container {
                width: 90%;
                margin: 20px auto;
                padding: 20px;
                border: 1px solid #000;
                box-shadow: 0px 0px 10px rgba(0, 0, 0, 0.1);
                box-sizing: border-box;
            }

            h2, h3, p {
                text-align: center;
                margin: 5px 0;
            }

            h2 {
                font-size: 1.8em;
                color: #004085;
            }

            h3 {
                font-size: 1.5em;
                margin-top: 15px;
            }

            .section-header {
                margin: 20px 0;
                font-weight: bold;
                font-size: 1.1em;
            }

            .info-table {
                width: 100%;
                margin-bottom: 15px;
                font-size: 1.1em;
                border-collapse: collapse;
            }

            .info-table td {
                padding: 2px 5px;
                vertical-align: top;
            }

            .info-table td:nth-child(2) {
                width: 35%;
            }

            .info-table .text-end {
                text-align: right;
            }

            .table {
                width: 100%;
                table-layout: fixed; /* Ensures consistent column widths */
                border-collapse: collapse;
                margin-top: 15px;
            }

            .table th, .table td {
                border: 1px solid #333;
                padding: 6px;
                text-align: center;
                word-wrap: break-word; /* Wrap long content */
                overflow-wrap: break-word; /* Ensures content fits in cells */
            }

            .table th {
                background-color: #f7f7f7;
                font-weight: bold;
                font-size: 1em;
            }

            .totals {
                margin-top: 15px;
                font-size: 1.2em;
                font-weight: bold;
                text-align: right;
            }

            .totals table {
                width: 50%;
                float: right;
                border-collapse: collapse;
            }

            .totals td {
                padding: 5px 10px;
                text-align: right;
            }

            .remarks {
                margin-top: 20px;
                padding: 10px;
                border: 1px solid #000;
                font-size: 1em;
                line-height: 1.5;
                clear: both;
            }

            .footer {
                margin-top: 20px;
                display: flex;
                justify-content: space-between;
                font-size: 0.9em;
                border-top: 1px solid #333;
                padding-top: 10px;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h2>LIFE HEALTHCARE CENTER</h2>
            <p>Abad Khak Chahar Rahe, Arzan Qemat, Kabul Afghanistan.</p>
            <p>Office cell #: 0093 766 62 62 62</p>
            <h3>PURCHASE</h3>

            <div class="info-table">
                <table>
                    <tr>
                        <td style="width: 20%;"><strong>Supplier Name:</strong></td>
                        <td style="width: 35%;">${previewContent.supplier_name || 'N/A'}</td>
                        <td style="width: 20%;" class="text-end"><strong>Serial #:</strong></td>
                        <td style="width: 25%; text-align: right;">${previewContent.purchase_no || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td><strong>Bill Number #:</strong></td>
                        <td>${previewContent.invoice_no || 'N/A'}</td>
                        <td class="text-end"><strong>Date:</strong></td>
                        <td style="text-align: right;">${previewContent.purchase_date || 'N/A'}</td>
                    </tr>
                    <tr>
                        <td><strong>Bilty/Other #:</strong></td>
                        <td>${previewContent.bilty_no || 'N/A'}</td>
                        <td class="text-end"><strong>Currency:</strong></td>
                        <td style="text-align: right;">${previewContent.currency || 'N/A'}</td>
                    </tr>
                </table>
            </div>

            <div class="section-header">Items Purchased</div>
            <table class="table">
                <thead>
                    <tr>
                        <th style='width:5%;'>Qty</th>
                        <th style='width:6%;'>BNS</th>
                        <th>Product Name</th>
                        <th>Batch#</th>
                        <th>Mfg. Date</th>
                        <th>Expiry</th>
                        <th>Price</th>
                        <th style='width:8%;'>DSC</th>
                        <th>Amount</th>
                    </tr>
                </thead>
                <tbody>
                    ${(previewContent.purchaseDetails || []).map(detail => `
                        <tr>
                            <td style='width:5%;'>${detail.quantity || 0}</td>
                            <td style='width:6%;'>${detail.bonus_quantity || 0}</td>
                            <td>${detail.product_name || 'N/A'}</td>
                            <td>${detail.batch_no || 'N/A'}</td>
                            <td>${detail.mfg_date || 'N/A'}</td>
                            <td>${detail.expiry_date || 'N/A'}</td>
                            <td>${detail.unit_price || 0}</td>
                            <td>${detail.discount || 0}</td>
                            <td>${detail.amount || 0}</td>
                        </tr>
                    `).join('')}
                    <tr>
                        <td colspan="9" style="text-align: left; font-weight: bold;">
                            Total (Units): ${previewContent.total_quantity || 0}
                        </td>
                    </tr>
                </tbody>
            </table>

            <div class="totals">
                <table>
                    <tr>
                        <td>Total Amount:</td>
                        <td>${totalAmount.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Total Discount:</td>
                        <td>${totalDiscount.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Net Amount:</td>
                        <td>${netAmount.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Paid Amount:</td>
                        <td>${paidAmount.toFixed(2)}</td>
                    </tr>
                    <tr>
                        <td>Due Amount:</td>
                        <td>${dueAmount.toFixed(2)}</td>
                    </tr>
                </table>
            </div>

            <div class="remarks">
                Remarks: (if any)
            </div>

            <div class="footer">
                <p>User: ${'{{ auth()->user()->name }}'}</p>
                <p>Print Date: ${'{{ now()->setTimezone("Asia/Kabul")->format("d-m-Y H:i:s A") }}'}</p>
            </div>
        </div>
    </body>
</html>

        `);
        printWindow.document.close();
        printWindow.print();
    }, 500); // Wait for 500ms to give Livewire enough time to fetch data
}
        </script>
        <script>
            document.getElementById('purchase_info').addEventListener('change', function () {
                // Call the Livewire function to fetch the selected data
                @this.fetchSelectedData(this.value);
            });

            // Listen for the 'close-modal' event dispatched from Livewire
            window.addEventListener('close-modal', function () {
                // Hide the search modal using Bootstrap's modal function
                var modalElement = document.getElementById('searchModal');
                var modalInstance = bootstrap.Modal.getInstance(modalElement);
                if (modalInstance) {
                    modalInstance.hide();
                }
            });
        </script>
    </div>
</div>
</div>
