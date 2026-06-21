<div class="container">
    <div class="row mb-2">
        <div class="col-md-1">
            @if(Auth::user()->can('service.receipt.add'))
            <button class="btn btn-outline-primary btn-icon-text btn-sm" wire:click="create" data-bs-toggle="modal" data-bs-target="#modal" wire:ignore>
                <i class="btn-icon-prepend" data-feather="plus-circle"></i>Add
            </button>
            @endif
        </div>
        <div class="col-md-8 text-start">
            <h3>Service Receipt List</h3s>
        </div>
        <div class="col-md-3">
            <input type="text" wire:model.live="search" class="form-control" placeholder="Search here...">
        </div>
    </div>

    <!-- Bootstrap Modal for creating or editing a Service Receipt -->
    <form wire:submit.prevent="{{ $id ? 'update' : 'store' }}">
        <div wire:ignore.self class="modal fade" id="modal" tabindex="-1" role="dialog" aria-labelledby="modalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl" role="document"> <!-- Added modal-lg class for larger width -->
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="modalLabel">{{ $id ? 'Edit Service Receipt' : 'Create Service Receipt' }}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeModal()"></button>
                    </div>

                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-2 form-group mb-1">
                                <label for="patient_id">Patient <span class="text-danger fw-300"> *</span></label>
                                <select wire:model="patient_id" id="patient_id" class="form-control form-control-sm mt-1">
                                    <option value="" disabled>Select Patient</option>
                                    @foreach($patients as $patient)
                                    <option value="{{ $patient->id }}">{{ $patient->name }}</option>
                                    @endforeach
                                </select>
                                @error('patient_id') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>

                            <div class="col-md-2 form-group mb-1">
                                <label for="doctor_id">Doctor <span class="text-danger fw-300"> *</span></label>
                                <select wire:model="doctor_id" id="doctor_id" class="form-control form-control-sm mt-1">
                                    <option value="" disabled>Select doctor</option>
                                    @foreach($employees as $employee)
                                    <option value="{{ $employee->id }}">{{ $employee->first_name ?? '' }} {{ $employee->last_name ?? '' }}</option>
                                    @endforeach
                                </select>
                                @error('doctor_id') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>

                            <div class="col-md-2 form-group mb-1">
                                <label for="is_active">Status</label>
                                <select wire:model="is_active" id="is_active" class="form-control form-control-sm mt-1">
                                    <option value="1">Active</option>
                                    <option value="0">Inactive</option>
                                </select>
                                @error('is_active') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>

                            <div class="col-md-2 form-group mb-1">
                                <label for="payment_status">Payment Status</label>
                                <select wire:model="payment_status" id="payment_status" class="form-control form-control-sm mt-1">
                                    <option value="" disabled>Select</option>
                                    <option value="pending">Pending</option>
                                    <option value="paid">Paid</option>
                                </select>
                                @error('payment_status') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>

                            <div class="col-md-2 form-group mb-1">
                                <label for="payment_method">Payment Method</label>
                                <select wire:model="payment_method" id="payment_method" class="form-control form-control-sm mt-1">
                                    <option value="" disabled>Select</option>
                                    <option value="cash">Cash</option>
                                    <option value="card">Card</option>
                                    <option value="insurance">Insurance</option>
                                </select>
                                @error('payment_method') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                            <!-- Receipt Date -->
                            <div class="col-md-2 form-group mb-1">
                                <label for="receipt_date">Receipt Date</label>
                                <input type="date" wire:model="receipt_date" id="receipt_date" class="form-control form-control-sm mt-1" disabled>
                                @error('receipt_date') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>

                        <div class="row mt-2">
                            <div class="col-md-12">
                                <div class="card">
                                    <div class="card-body">
                                        <div class="table-responsive" style="min-height: 196px; max-height: 196px; overflow-y: auto;">
                                            <table class="table table-bordered table-hover" style="border-spacing: 0; border-collapse: collapse;">
                                                <thead class="mb-2">
                                                    <tr>
                                                        <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Service Name</th>
                                                        <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Price</th>
                                                        <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Total (AFN)</th>
                                                        @if($isEditing)
                                                        <th class="p-1" style="position: sticky; top: 0; z-index: 1;">Action</th>
                                                        @endif
                                                    </tr>
                                                </thead>

                                                <tbody>
                                                    @foreach ($serviceReceiptDetails as $key => $serviceReceiptDetail)
                                                    <tr>
                                                        <td>
                                                            <div class="form-group @error('service_id') has-error @enderror">
                                                                @if($isChangesEnabled)
                                                                <select class="form-control form-control-sm"
                                                                    id="service_id.{{ $key }}"
                                                                    name="service_id.{{ $key }}"
                                                                    wire:model="serviceReceiptDetails.{{ $key }}.service_id"
                                                                    wire:change="fetchServiceDetails({{ $key }})"
                                                                    onchange="focusNextField('quantity.{{ $key }}')">
                                                                    <option value="">--Select--</option>
                                                                    @foreach($services as $service)
                                                                    <option value="{{ $service->id }}">{{ strtoupper($service->name) }}</option>
                                                                    @endforeach
                                                                </select>
                                                                @else
                                                                @foreach($services as $service)
                                                                @if($service->id == ($serviceReceiptDetails[$key]['service_id'] ?? null))
                                                                {{ strtoupper($service->name) }}
                                                                @endif
                                                                @endforeach
                                                                @endif
                                                            </div>
                                                        </td>

                                                        <!-- for storing Service Type Id -->
                                                        @if($isChangesEnabled)
                                                        <input type="hidden" class="form-control form-control-sm"
                                                            id="service_type_id.{{ $key }}"
                                                            name="service_type_id.{{ $key }}"
                                                            wire:model.defer="serviceReceiptDetails.{{ $key }}.service_type_id"
                                                            disabled>
                                                        @else
                                                        @if(isset($serviceReceiptDetails[$key]['service_type_id']))
                                                        {{ strtoupper($serviceReceiptDetails[$key]['service_type_id']) }}
                                                        @endif
                                                        @endif

                                                        <!-- for calculating qtty*price=amount -->
                                                        @if($isChangesEnabled)
                                                        <input type="hidden" class="form-control form-control-sm"
                                                            id="quantity.{{ $key }}"
                                                            name="quantity.{{ $key }}"
                                                            wire:model.lazy="serviceReceiptDetails.{{ $key }}.quantity"
                                                            min="0"
                                                            wire:blur="calculateItemAmount({{ $key }})"
                                                            oninput="this.value = this.value.replace(/[^0-9]/g, '');"
                                                            autocomplete="off"
                                                            onkeydown="focusNextOnEnter(event, 'price.{{ $key }}')">
                                                        @else
                                                        @if(isset($saleInvoiceDetails[$key]['quantity']))
                                                        {{ $saleInvoiceDetails[$key]['quantity'] }}
                                                        @endif
                                                        @endif

                                                        <td>
                                                            @if($isChangesEnabled)
                                                            <input type="text" class="form-control form-control-sm"
                                                                id="price.{{ $key }}"
                                                                name="price.{{ $key }}"
                                                                wire:model.defer="serviceReceiptDetails.{{ $key }}.price"
                                                                disabled>
                                                            @else
                                                            @if(isset($serviceReceiptDetails[$key]['price']))
                                                            {{ strtoupper($serviceReceiptDetails[$key]['price']) }}
                                                            @endif
                                                            @endif
                                                        </td>
                                                        <td>
                                                            @if($isChangesEnabled)
                                                            <input type="number" class="form-control form-control-sm"
                                                                id="total.{{ $key }}"
                                                                name="total.{{ $key }}"
                                                                wire:model.defer="serviceReceiptDetails.{{ $key }}.total"
                                                                disabled>
                                                            @else
                                                            @if(isset($serviceReceiptDetails[$key]['total']))
                                                            {{ $serviceReceiptDetails[$key]['total'] }}
                                                            @endif
                                                            @endif
                                                        </td>
                                                        @if($isEditing)
                                                        <td>
                                                            <button type="button" class="btn btn-outline-danger btn-xs" wire:click="removeServiceReceiptDetail({{ $key }})">Remove</button>
                                                        </td>
                                                        @endif
                                                    </tr>
                                                    @endforeach
                                                </tbody>

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

                                                    document.addEventListener('keydown', function(event) {
                                                        if (event.shiftKey && event.key === 'A') {
                                                            event.preventDefault();
                                                            document.getElementById('add_item_button').click();
                                                        }
                                                    });
                                                </script>

                                            </table>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="row mt-2">
                            <div class="col-md-12">
                                <div class="card">
                                    <div class="card-body">
                                        <div class="row">
                                            <!-- Total Amount -->
                                            <div class="col-md-2">
                                                <div class="form-group @error('total_amount') has-error @enderror">
                                                    <label for="total_amount" class="control-label" style="font-size: 0.75rem;">Total Amount</label>
                                                    <input type="number" class="form-control form-control-sm" id="total_amount" name="total_amount" wire:model="total_amount" placeholder="0.00" disabled>
                                                    @error('total_amount') <span class="text-danger">{{ $message }}</span> @enderror
                                                </div>
                                            </div>
                                            <!-- Discount -->
                                            <div class="col-md-2 form-group mb-1">
                                                <label for="discount">Discount</label>
                                                <input type="number" class="form-control form-control-sm mt-1" id="discount" name="discount" wire:model.debounce.500ms="discount" placeholder="i.e.%">
                                                @error('discount') <span class="text-danger">{{ $message }}</span> @enderror
                                            </div>

                                            <!-- Total Discount -->
                                            <div class="col-md-2">
                                                <div class="form-group @error('discount_amount') has-error @enderror">
                                                    <label for="discount_amount" class="control-label" style="font-size: 0.75rem;">Discount Amount</label>
                                                    <input type="text" class="form-control form-control-sm" id="discount_amount" name="discount_amount" wire:model="discount_amount" placeholder="0.00" disabled>
                                                    @error('discount_amount') <span class="text-danger">{{ $message }}</span> @enderror
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
                                                    <input type="number" class="form-control form-control-sm" id="paid_amount" name="paid_amount" wire:model="paid_amount" placeholder="0.00" disabled>
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
                                        </div>
                                        <div class="row mt-2">
                                            <!-- Discount Reason -->
                                            <div class="col-md-10">
                                                <div class="form-group @error('discount_reason') has-error @enderror">
                                                    <label for="discount_reason" class="control-label" style="font-size: 0.75rem;">Discount Reason</label>
                                                    <input type="text" class="form-control form-control-sm" id="discount_reason" name="discount_reason" wire:model="discount_reason" placeholder="Discount Reason">
                                                    @error('discount_reason') <span class="text-danger">{{ $message }}</span> @enderror
                                                </div>
                                            </div>
                                            <div class="col-md-2">
                                                @if($isEditing)
                                                <label for="group_action" class="control-label" style="font-size: 0.75rem;">Actions</label>
                                                @endif
                                                @if(Auth::user()->can('service.receipt.add') || Auth::user()->can('service.receipt.edit'))

                                                <div class="btn-group btn-group-justified" role="group">
                                                    @if($isEditing)
                                                    <button type="button" class="btn btn-primary btn-sm" id="add_item_button" wire:click.prevent="addItem" title="Add New Item" wire:ignore>Add</button>
                                                    @endif
                                                    @if($isStoring)
                                                    <button type="button" class="btn btn-secondary btn-sm" id="cancel_button" wire:click="cancel_store" title="Cancel Store" wire:ignore data-bs-dismiss="modal">Cancel</button>
                                                    <button type="submit" class="btn btn-success btn-sm" id="save_button" title="Store Record" wire:ignore>Save</button>
                                                    @endif
                                                    @if($isUpdating)
                                                    <button type="button" class="btn btn-secondary btn-sm" id="cancel_button" wire:click="cancel_update" title="Cancel Update" wire:ignore data-bs-dismiss="modal">Cancel</button>
                                                    <button type="submit" class="btn btn-success btn-sm" id="save_button" title="Update Record" wire:ignore>Save</button>
                                                    @endif
                                                </div>
                                                @endif

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
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </form>

    <!-- Table displaying Service Receipt List -->
    <div class="table-responsive">
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Total Amount</th>
                    <th>Discount</th>
                    <th>Receipt Date</th>
                    <th>Created By</th>
                    @if(Auth::user()->can('service.receipt.edit') || Auth::user()->can('service.receipt.delete') || Auth::user()->can('service.receipt.details'))
                    <th>Action</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($service_receipts as $service_receipt)
                <tr>
                    <td>{{ $service_receipt->id }}</td>
                    <td>{{ $service_receipt->patient->name }}</td>
                    <td>{{ $service_receipt->employee->first_name }} {{ $service_receipt->employee->last_name }}</td>
                    <td>{{ $service_receipt->net_amount }}</td>
                    <td>{{ $service_receipt->discount_amount }}</td>
                    <td>{{ $service_receipt->receipt_date }}</td>
                    <td>{{ ($service_receipt->user) ? $service_receipt->user->name : 'Unknown' }}</td>
                    @if(Auth::user()->can('service.receipt.edit') || Auth::user()->can('service.receipt.delete') || Auth::user()->can('service.receipt.details'))
                    <td>
                        @if(Auth::user()->can('service.receipt.edit'))
                        <button wire:click="edit({{ $service_receipt->id }})" class="btn btn-icon-text btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#modal" title="Edit">
                            <i class="btn-icon-prepend" data-feather="edit"></i>Edit
                        </button>
                        @endif
                        @if(Auth::user()->can('service.receipt.delete'))
                        <button wire:click="delete({{ $service_receipt->id }})" class="btn btn-icon-text btn-sm btn-outline-danger" title="Delete">
                            <i class="btn-icon-prepend" data-feather="trash-2"></i>Delete
                        </button>
                        @endif
                        @if(Auth::user()->can('service.receipt.details'))
                        <button wire:click="showDetails({{ $service_receipt->id }})" class="btn btn-icon-text btn-sm btn-outline-info" data-bs-toggle="modal" data-bs-target="#detailsModal">
                            <i class="btn-icon-prepend" data-feather="info"></i>Details
                        </button>
                        @endif
                    </td>
                    @endif
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <!-- Pagination Links -->
    {{ $service_receipts->links() }}

    <!-- Show Details Modal -->
    <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog" aria-labelledby="detailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl" role="document">
            <div class="modal-content">
                <!-- Header -->
                <div class="modal-header  text-white">
                    <h5 class="modal-title" id="detailsModalLabel">Service Receipt Details</h5>
                    <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
                </div>

                <!-- Body -->
                <div class="modal-body">
                    <!-- Displaying the Header Details of Service Receipt. -->
                    <div class="row mb-2">
                        <div class="col-md-2">
                            <span class="text-primary small">Patient Name:</span><br>
                            <span class="text-white">{{ $selected_data?->patient->name }}</span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Doctor Name:</span><br>
                            <span class="text-white">{{ $selected_data?->employee->first_name }} {{ $selected_data?->employee->last_name }}</span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Created By:</span><br>
                            <span class="text-white">{{ $selected_data?->user?->name }}</span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Payment Method:</span><br>
                            <span class="text-white">{{ ucfirst($selected_data?->payment_method) }}</span>
                        </div>
                        <div class="col-md-1">
                            <span class="text-primary small">Payment:</span><br>
                            <span class="badge {{ $selected_data?->payment_status == 'paid' ? 'bg-success' : 'bg-danger' }}">
                                {{ ucfirst($selected_data?->payment_status) }}
                            </span>
                        </div>
                        <div class="col-md-1">
                            <span class="text-primary small">Status:</span><br>
                            <span class="badge {{ $selected_data?->is_active == 1 ? 'bg-success' : 'bg-secondary' }}">
                                {{ $selected_data?->is_active == 1 ? 'Active' : 'Inactive' }}
                            </span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Receipt Date:</span><br>
                            <span class="text-white">{{ $selected_data?->receipt_date }}</span>
                        </div>
                    </div>

                    <!-- Displaying the details of the selected Receipt Details as foreach loop. -->
                    <div class="row">
                        <div class="col-md-12">
                            <div class="table-responsive" style="max-height: 256px; overflow-y: auto;">
                                <table class="table table-bordered table-hover">
                                    <thead style="position: sticky; top: 0; z-index: 1;">
                                        <tr>
                                            <th>Service Name</th>
                                            <th>Service Type</th>
                                            <th>Quantity</th>
                                            <th>Price</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @if($selected_data?->service_receipt_details)
                                        @foreach($selected_data->service_receipt_details as $service_receipt_detail)
                                        <tr>
                                            <td>{{ $service_receipt_detail->service->name }}</td>
                                            <td>{{ $service_receipt_detail->service_type->name }}</td>
                                            <td>{{ $service_receipt_detail->quantity }}</td>
                                            <td>{{ $service_receipt_detail->price }}</td>
                                            <td>{{ $service_receipt_detail->total }}</td>
                                        </tr>
                                        @endforeach
                                        @else
                                        <tr>
                                            <td colspan="5" class="text-center">No service receipt details found.</td>
                                        </tr>
                                        @endif
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Displaying the Footer Details of Service Receipt -->
                    <div class="row mt-2">
                        <div class="col-md-2">
                            <span class="text-primary small">Total Amount:</span><br>
                            <span class="text-success">{{ number_format($selected_data?->total_amount, 2) }}</span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Discount:</span><br>
                            <span class="text-success">{{ $selected_data?->discount }}%</span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Discount Amount:</span><br>
                            <span class="text-success">{{ number_format($selected_data?->discount_amount, 2) }}</span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Net Amount:</span><br>
                            <span class="text-success">{{ number_format($selected_data?->net_amount, 2) }}</span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Paid Amount:</span><br>
                            <span class="text-success">{{ number_format($selected_data?->paid_amount, 2) }}</span>
                        </div>
                        <div class="col-md-2">
                            <span class="text-primary small">Due Amount:</span><br>
                            <span class="text-danger">{{ number_format($selected_data?->due_amount, 2) }}</span>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="modal-footer d-flex justify-content-end">
                    <button type="button" class="btn btn-secondary btn-sm" data-bs-dismiss="modal">Close</button>
                    @if(Auth::user()->can('service.receipt.print'))
                    <button type="button" class="btn btn-primary btn-sm" onclick="printModalContent()">Print</button>
                    @endif

                </div>
            </div>
        </div>
    </div>

    <!-- Print Receipt Modal -->
    <div id="printableContent" style="display: none; margin:0; padding:0;">
        <div style="width: 80mm; margin: 0; padding: 0; font-family: Arial, sans-serif; font-size: 9px;">
            <!-- Header Section -->
            <h6 style="text-align: center; margin: 0;">LIFE HEALTHCARE CENTER</h6>
            <small style="display: block; text-align: center; margin: 0;">Office Cell #: 0093 786 62 62 62</small>
            <p style="text-align: center; margin: 5px 0;"><strong>SERVICE RECEIPT</strong></p>

            <!-- Header Service Receipt Information -->
            <div class="row mb-3">
                <div class="d-flex justify-content-between">
                    <div>
                        <p style="margin: 0;">Patient: {{ $selected_data?->patient->name ?? 'N/A' }}</p>
                        <p style="margin: 0;">Doctor: {{ $selected_data?->employee->first_name ?? 'N/A' }} {{ $selected_data?->employee->last_name ?? '' }}</p>
                    </div>
                    <div class="text-end">
                        <p style="margin: 0;">Serial No.: {{ $selected_data?->id ?? 'N/A' }}</p>
                        <p style="margin: 0;">Date: {{ $selected_data?->receipt_date ?? 'N/A' }}</p>
                    </div>
                </div>
            </div>

            <!-- Service Receipt Details Section -->
            <table style="width: 100%;">
                <thead style="border-bottom: 1px dotted #000;">
                    <tr>
                        <th style="text-align: left;">Service</th>
                        <th style="text-align: left;">Type</th>
                        <th style="text-align: center;">Qtty</th>
                        <th style="text-align: right;">Price</th>
                        <th style="text-align: right;">Amount</th>
                    </tr>
                </thead>
                <tbody>
                    @if($selected_data?->service_receipt_details)
                    @foreach($selected_data->service_receipt_details as $service_receipt_detail)
                    <tr>
                        <td>{{ $service_receipt_detail->service->name }}</td>
                        <td>{{ $service_receipt_detail->service_type->name }}</td>
                        <td>{{ $service_receipt_detail->quantity }}</td>
                        <td>{{ $service_receipt_detail->price }}</td>
                        <td>{{ $service_receipt_detail->total }}</td>
                    </tr>
                    @endforeach
                    @else
                    <tr>
                        <td colspan="5" class="text-center">No service receipt details found.</td>
                    </tr>
                    @endif
                </tbody>
            </table>

            <!-- Summary Section -->
            <div style="margin-top: 5px;border-top: 1px dotted #000;">
                <p style="text-align: right; margin: 2px 0;"><strong>Total Amount:</strong> {{ number_format($selected_data?->total_amount, 2) }}</p>
                <p style="text-align: right; margin: 2px 0;"><strong>Total Discount:</strong> {{ number_format($selected_data?->discount_amount, 2) }}</p>
                <p style="text-align: right; margin: 2px 0;"><strong>Net Amount:</strong> {{ number_format($selected_data?->net_amount, 2) }}</p>
                <p style="text-align: right; margin: 2px 0;"><strong>Paid Amount:</strong> {{ $selected_data?->payment_status == 'paid' ? number_format($selected_data?->paid_amount, 2) : '0.00' }}</p>
                <p style="text-align: right; margin: 2px 0;"><strong>Due Amount:</strong> {{ $selected_data?->payment_status == 'pending' ? number_format($selected_data?->due_amount, 2) : '0.00' }}</p>
            </div>

            <!-- Dotted Line Separator -->
            <div style="border-bottom: 1px dashed #000; margin: 8px 0;"></div>

            <!-- Footer Section -->
            <div class="d-flex justify-content-between mb-2">
                <small style="display: block;margin: 0;">User: {{ $selected_data?->user->name ?? 'Admin' }}</small>
                <small style="display: block; margin: 0;">Printed at: {{ now()->format('Y-m-d h:i:s A') }}</small>
            </div>
            <div class="row">
                <div class="col-12 mb-2">
                    <small style="display: block; text-align: center;">Thank you for your Visit!</small>
                </div>
            </div>
        </div>
    </div>

</div>
<!-- Modal Event Listeners -->
<script>
    document.addEventListener('livewire:load', function() {
        window.addEventListener('open-modal', () => {
            var modal = new bootstrap.Modal(document.getElementById('modal'));
            modal.show();
        });

        window.addEventListener('close-modal', () => {
            var modal = bootstrap.Modal.getInstance(document.getElementById('modal'));
            modal.hide();
        });
    });

    window.addEventListener('save-modal', () => {
        var modal = bootstrap.Modal.getInstance(document.getElementById('modal'));
        modal.hide();
    });
</script>
<script>
    function printModalContent() {
        var printContent = document.getElementById('printableContent').innerHTML;

        if (printContent.trim() !== '') {
            var originalContent = document.body.innerHTML;

            // Set up the print content at the top left corner
            document.body.innerHTML = `
                <div style="position: absolute; top: 10px; left: 10px;">
                    ${printContent}
                </div>
            `;

            // Print the content
            window.print();

            // Restore original body content
            document.body.innerHTML = originalContent;

            // Reload the page to ensure everything is back to normal
            window.location.reload();
        } else {
            alert('Details not available for printing.');
        }
    }
</script>




<!-- JavaScript for Printing -->
