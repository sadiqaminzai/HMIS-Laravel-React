<div>
    <div class="container">
        <!-- Page Title -->
        <div class="row mb-3">
            <div class="col-md-12 text-center">
                <h3 class="fw-bold text-primary">Return Invoice Receipt Report</h3>
            </div>
        </div>
        
        <!-- Collapsible Search Options -->
        <div class="card mb-3 shadow-sm">
            <div class="card-header py-2" role="button" data-bs-toggle="collapse" data-bs-target="#searchOptionsCollapse" aria-expanded="false" aria-controls="searchOptionsCollapse">
                <div class="d-flex justify-content-between align-items-center">
                    <h6 class="mb-0"><i class="fas fa-search text-white me-2"></i>Search Options <i class="fas fa-filter fa-xs text-white ms-1"></i></h6>
                    <i class="fas fa-chevron-down"></i>
                </div>
            </div>
            <div class="collapse" id="searchOptionsCollapse">
                <div class="card-body py-2">
                    <div class="row g-2">
                        <!-- First Row -->
                        <div class="col-md-3">
                            <div class="form-group">
                                <label for="search_return_invoice_id" class="form-label small fw-bold mb-1">Invoice ID</label>
                                <select wire:model="search_return_invoice_id" id="search_return_invoice_id" class="form-select form-select-sm">
                                    <option value="" selected>Select ID</option>
                                    @foreach($invoices as $invoice)
                                    <option value="{{ $invoice->return_invoice_id }}">{{ $invoice->return_invoice_id }}</option>
                                    @endforeach
                                </select>
                            </div>
                        </div>
                        
                        <div class="col-md-3">
                            <div class="form-group">
                                <label for="search_return_invoice_date" class="form-label small fw-bold mb-1">Invoice Date</label>
                                <select wire:model="search_return_invoice_date" id="search_return_invoice_date" class="form-select form-select-sm">
                                    <option value="" selected>Select Date</option>
                                    @foreach($invoices as $invoice)
                                    <option value="{{ $invoice->return_invoice_date }}">{{ $invoice->return_invoice_date }}</option>
                                    @endforeach
                                </select>
                            </div>
                        </div>
                        
                        <div class="col-md-3">
                            <div class="form-group">
                                <label for="search_patient_name" class="form-label small fw-bold mb-1">Patient</label>
                                <select wire:model="search_patient_name" id="search_patient_name" class="form-select form-select-sm">
                                    <option value="" selected>Select Patient</option>
                                    @foreach($invoices as $invoice)
                                    <option value="{{ $invoice->patient->name }}">{{ $invoice->patient->name }}</option>
                                    @endforeach
                                </select>
                            </div>
                        </div>
                        
                        <div class="col-md-3">
                            <div class="form-group">
                                <label for="search_payment_status" class="form-label small fw-bold mb-1">Payment Status</label>
                                <select wire:model="search_payment_status" id="search_payment_status" class="form-select form-select-sm">
                                    <option value="" selected>Select Status</option>
                                    <option value="pending">Pending</option>
                                    <option value="paid">Paid</option>
                                </select>
                            </div>
                        </div>
                        
                        <!-- Second Row -->
                        <div class="col-md-2">
                            <div class="form-group">
                                <label for="search_payment_method" class="form-label small fw-bold mb-1">Payment Method</label>
                                <select wire:model="search_payment_method" id="search_payment_method" class="form-select form-select-sm">
                                    <option value="" selected>Select Method</option>
                                    <option value="cash">Cash</option>
                                    <option value="card">Card</option>
                                    <option value="insurance">Insurance</option>
                                </select>
                            </div>
                        </div>
                        
                        <div class="col-md-3">
                            <div class="form-group">
                                <label class="form-label small fw-bold mb-1">Invoice ID Range</label>
                                <div class="input-group input-group-sm">
                                    <input type="number" class="form-control form-control-sm" id="searchFromId" wire:model="searchFromId" placeholder="From">
                                    <input type="number" class="form-control form-control-sm" id="searchToId" wire:model="searchToId" placeholder="To">
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-md-4">
                            <div class="form-group">
                                <label class="form-label small fw-bold mb-1">Date Range</label>
                                <div class="input-group input-group-sm">
                                    <input type="date" wire:model="searchFromDate" class="form-control form-control-sm" placeholder="From">
                                    <input type="date" wire:model="searchToDate" class="form-control form-control-sm" placeholder="To">
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-md-3 d-flex align-items-end">
                            @if(Auth::user()->can('sale.invoice.search'))
                            <div class="btn-group btn-group-sm">
                                <button wire:click="searchDetails" class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#searchModal">
                                    <i class="btn-icon-prepend" data-feather="search"></i> Search
                                </button>
                                <button wire:click="clearSearch" class="btn btn-danger btn-sm">
                                    <i class="btn-icon-prepend" data-feather="x-circle"></i> Clear
                                </button>
                            </div>
                            @endif
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Details Modal -->
        <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog" aria-labelledby="detailsModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg" role="document">
                <div class="modal-content">
                    <!-- Header -->
                    <div class="modal-header text-white">
                        <h5 class="modal-title" id="detailsModalLabel">Return Invoice Details</h5>
                        <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
                    </div>

                    <!-- Body -->
                    <div class="modal-body p-2">
                        <!-- Invoice Information in Two-Column Grid -->
                        <div class="row g-3">
                            <div class="col-md-4">
                                <div class="p-3 rounded border">
                                    <strong>Return Invoice ID:</strong> {{ $selectedInvoice?->return_invoice_id }}
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="p-3 rounded border">
                                    <strong>Return Invoice Date:</strong> {{ $selectedInvoice?->return_invoice_date }}
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
                                    <strong>Created By:</strong> {{ $selectedInvoice?->user->name ?? 'N/A' }}
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
                                    <strong>Print Date:</strong> {{ $selectedInvoice?->print_date ?? 'N/A' }}
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
                        <th>Return Invoice ID</th>
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
                    @foreach($invoices as $key => $invoice)
                    <tr>
                        <td>{{ $key + 1 }}</td>
                        <td>{{ $invoice->return_invoice_id }}</td>
                        <td>{{ $invoice->patient->name ?? 'N/A' }}</td>
                        <td>{{ $invoice->return_invoice_date }}</td>
                        <td>
                            <span class="badge {{ $invoice->payment_status == 'paid' ? 'bg-success' : 'bg-warning' }}">
                                {{ $invoice->payment_status }}
                            </span>
                        </td>
                        <td>{{ $invoice->payment_method }}</td>
                        <td>{{ $invoice->net_amount }}</td>
                        <td>{{ $invoice->paid_amount }}</td>
                        <td>{{ $invoice->due_amount }}</td>
                      
                          
                        @if(Auth::user()->can('sale.invoice.details'))
                        <td>
                            <button wire:click="showDetails({{ $invoice->id }})" class="btn btn-icon-text btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#detailsModal">
                                <i class="btn-icon-prepend" data-feather="info"></i>Details
                            </button>
                        @endif
                        </td>
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

    <!-- Search Return Invoice Modal -->
    <div wire:ignore.self class="modal fade" id="searchModal" tabindex="-1" role="dialog" aria-labelledby="searchModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl" role="document">
            <div class="modal-content">
                <!-- Header -->
                <div class="modal-header text-white">
                    <h5 class="modal-title" id="searchModalLabel">Return Invoice Details</h5>
                    @if(Auth::user()->can('patient.add'))
                    <div class="col-md-3 text-end">
                        <div class="btn-group" role="group">
                            <button class="btn btn-outline-success btn-icon-text btn-sm" wire:click="excel">Excel</button>
                            <button class="btn btn-outline-danger btn-icon-text btn-sm" wire:click="pdf">PDF</button>
                            <button class="btn btn-outline-secondary btn-icon-text btn-sm" onclick="window.open('{{ url('/reception/return-invoice-report-print') }}', '_blank')">Print</button>
                        </div>
                    </div>
                    @endif
                    <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeSearchModal"></button>
                </div>
                <!-- Body -->
                <div class="modal-body p-2" style="max-height: 400px; overflow-y: auto;">
                    <div class="table-responsive">
                        <table class="table table-bordered">
                            <thead>
                                <tr>
                                    <th>S.No</th>
                                    <th>Return Invoice ID</th>
                                    <th>Patient Name</th>
                                    <th>Return Invoice Date</th>
                                    <th>Payment Status</th>
                                    <th>Payment Method</th>
                                    <th>Net Amount</th>
                                    <th>Paid Amount</th>
                                    <th>Due Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse($searchResults as $key => $invoice)
                                <tr>
                                    <td>{{ $key + 1 }}</td>
                                    <td>{{ $invoice->return_invoice_id }}</td>
                                    <td>{{ $invoice->patient->name }}</td>
                                    <td>{{ $invoice->return_invoice_date }}</td>
                                    <td>
                                        <span class="badge {{ $invoice->payment_status == 'paid' ? 'bg-success' : 'bg-warning' }}">
                                            {{ $invoice->payment_status }}
                                        </span>
                                    </td>
                                    <td>{{ $invoice->payment_method }}</td>
                                    <td>{{ $invoice->net_amount }}</td>
                                    <td>{{ $invoice->paid_amount }}</td>
                                    <td>{{ $invoice->due_amount }}</td>
                                </tr>
                                @empty
                                <tr>
                                    <td colspan="9" class="text-center">No Return Invoice records found.</td>
                                </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
                <!-- Footer -->
                <div class="modal-footer d-flex justify-content-between" style="margin-left: 20%; margin-right: 20%;">
                    <div>
                        <strong>Total Net Amount:</strong> <span>{{ number_format($totalNetAmount, 2) }}</span>
                    </div>
                    <div>
                        <strong>Total Paid Amount:</strong> <span>{{ number_format($totalPaidAmount, 2) }}</span>
                    </div>
                    <div>
                        <strong>Total Due Amount:</strong> <span>{{ number_format($totalDueAmount, 2) }}</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>