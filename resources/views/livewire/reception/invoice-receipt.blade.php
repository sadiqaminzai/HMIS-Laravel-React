<div class="container">
    <div class="row mb-1">
        <div class="col-md-12 text-start">
            <h3>Sale Invoice Receipt List</h3>
        </div>
    </div>
    <div class="row mb-1">
        <div class="col-md-12 text-start">
            Search by:
        </div>
    </div>
    <div class="row mb-3">
        <div class="col-md-2">
            <select wire:model="search_invoice_no" class="form-select">
                <option value="" disabled>Select Invoice No</option>
                @foreach($invoices as $invoice)
                <option value="{{ $invoice->invoice_no }}">{{ $invoice->invoice_no }}</option>
                @endforeach
            </select>
        </div>
        <div class="col-md-2">
            <select wire:model="search_invoice_date" class="form-select">
                <option value="" disabled>Select Invoice Date</option>
                @foreach($invoices as $invoice)
                <option value="{{ $invoice->invoice_date }}">{{ $invoice->invoice_date }}</option>
                @endforeach
            </select>
        </div>
        <div class="col-md-2">
            <select wire:model="search_patient_name" class="form-select">
                <option value="" disabled>Select Patient Name</option>
                @foreach($invoices as $invoice)
                <option value="{{ $invoice->patient->name }}">{{ $invoice->patient->name }}</option>
                @endforeach
            </select>
        </div>
        <div class="col-md-2">
            <select wire:model="search_payment_status" class="form-select">
                <option value="" disabled>Select Payment Status</option>
                <option value="pending">Pending</option>
                <option value="paid">Paid</option>
            </select>
        </div>
        <div class="col-md-2">
            <select wire:model="search_payment_method" class="form-select">
                <option value="" disabled>Select Payment Method</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="insurance">Insurance</option>
            </select>
        </div>
        @if(Auth::user()->can('sale.invoice.search'))
        <div class="col-md-2">
            <button wire:click="search" class="btn btn-outline-info btn-icon-text btn-sm">
                <i class="btn-icon-prepend" data-feather="search"></i>Search
            </button>
            <button wire:click="clearSearch" class="btn btn-outline-danger btn-icon-text btn-sm">
                <i class="btn-icon-prepend" data-feather="x-circle"></i>Clear
            </button>
        </div>
        @endif
    </div>

    <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog" aria-labelledby="detailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <!-- Header -->
                <div class="modal-header text-white">
                    <h5 class="modal-title" id="detailsModalLabel">Invoice Details</h5>
                    <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
                </div>

                <!-- Body -->
                <div class="modal-body p-2">
                    <!-- Invoice Information in Two-Column Grid -->
                    <div class="row g-3">
                        <div class="col-md-4">
                            <div class="p-3 rounded border">
                                <strong>Invoice No:</strong>{{ $selectedInvoice?->invoice_no }}
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-3 rounded border">
                                <strong>Invoice Date:</strong> {{ $selectedInvoice?->invoice_date }}
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-3 rounded border">
                                <strong>Patient Name:</strong> {{ $selectedInvoice?->patient->name }}
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-3 rounded border">
                                <strong>Payment Status:</strong> {{ $selectedInvoice?->payment_status }}
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-3 rounded border">
                                <strong>Payment Method:</strong> {{ $selectedInvoice?->payment_method }}
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-3 rounded border">
                                <strong>Approved By:</strong> {{ $selectedInvoice?->approved_by }}
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-3 rounded border">
                                <strong>Total Amount:</strong> {{ $selectedInvoice?->total_amount }}
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-3 rounded border">
                                <strong>Total Discount:</strong> {{ $selectedInvoice?->total_discount }}
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-3 rounded border">
                                <strong>Total Quantity:</strong> {{ $selectedInvoice?->total_quantity }}
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-3 rounded border">
                                <strong>Net Amount:</strong> {{ $selectedInvoice?->net_amount }}
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-3 rounded border">
                                <strong>Paid Amount:</strong> {{ $selectedInvoice?->paid_amount }}
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-3 rounded border">
                                <strong>Due Amount:</strong> {{ $selectedInvoice?->due_amount }}
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-3 rounded border">
                                <strong>Created By:</strong> {{ $selectedInvoice?->user->name ?? 'N/A' }}
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-3 rounded border">
                                <strong>Status:</strong> {{ $is_active ? 'Active' : 'Inactive' }}
                            </div>
                        </div>
                        <div class="col-md-4">
                            <div class="p-3 rounded border">
                                <strong>Deleted:</strong> {{ $is_delete ? 'Yes' : 'No' }}
                            </div>
                        </div>
                        <!-- <div class="col-md-4">
                            <div class="p-3 rounded border">
                                <strong>Discount Reason:</strong> {{ $selectedInvoice?->discount_reason }}
                            </div>
                        </div> -->
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Table displaying Product details -->
    <div class="table-responsive">
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>S.No</th>
                    <th>Patient Name</th>
                    <th>Date</th>
                    <th>Payment Status</th>
                    <th>Payment Method</th>
                    <th>Net Amount</th>
                    <th>Paid Amount</th>
                    <th>Due Amount</th>
                @if(Auth::user()->can('sale.invoice.manage') || Auth::user()->can('sale.invoice.details'))
                    <th>Actions</th>
                @endif
                </tr>
            </thead>
            <tbody>
                @foreach($invoices as $invoice)
                <tr>
                    <td>{{ $invoice->invoice_no }}</td>
                    <td>{{ $invoice->patient->name ?? 'N/A' }}</td>
                    <td>{{ $invoice->invoice_date }}</td>
                    <td>
                        <span class="badge {{ $invoice->payment_status == 'paid' ? 'bg-success' : 'bg-warning' }}">
                            {{ $invoice->payment_status }}
                        </span>
                    </td>
                    <td>{{ $invoice->payment_method }}</td>
                    <td>{{ $invoice->net_amount }}</td>
                    <td>{{ $invoice->paid_amount }}</td>
                    <td>{{ $invoice->due_amount }}</td>
                    @if(Auth::user()->can('sale.invoice.manage') || Auth::user()->can('sale.invoice.details'))
                    <td>
                        @if(Auth::user()->can('sale.invoice.manage'))
                        <button wire:click="togglePaymentStatus({{ $invoice->id }})"
                                class="btn btn-icon-text btn-sm {{ $invoice->payment_status == 'paid' ? 'btn-outline-success' : 'btn-outline-warning' }}"
                                title="Toggle Payment Status">
                            <i class="btn-icon-prepend" data-feather="refresh-cw"></i>{{ $invoice->payment_status == 'paid' ? 'Mark as Pending' : 'Mark as Paid' }}
                        </button>
                    @else
                        @if($invoice->payment_status == 'pending')
                            <button wire:click="togglePaymentStatus({{ $invoice->id }})"
                                    class="btn btn-icon-text btn-sm btn-outline-success"
                                    title="Mark as Paid">
                                <i class="btn-icon-prepend" data-feather="refresh-cw"></i>Mark as Paid
                            </button>
                        @endif
                    @endif
                      
                    @if(Auth::user()->can('sale.invoice.details'))

                        <button wire:click="showDetails({{ $invoice->id }})" class="btn btn-icon-text btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#detailsModal">
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
    {{ $invoices->links() }}
</div>

<!-- Modal Event Listeners -->
<script>
    document.addEventListener('livewire:load', function() {
        window.addEventListener('open-modal', () => {
            var modal = new bootstrap.Modal(document.getElementById('detailsModal'));
            modal.show();
        });

        window.addEventListener('close-modal', () => {
            var modal = bootstrap.Modal.getInstance(document.getElementById('detailsModal'));
            modal.hide();
        });
    });

    window.addEventListener('save-modal', () => {
        var modal = bootstrap.Modal.getInstance(document.getElementById('detailsModal'));
        modal.hide();
    });
</script>