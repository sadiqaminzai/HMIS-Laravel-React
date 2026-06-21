<div>
    <div class="container">
        <div class="row mb-3">
            <div class="col-md-12 text-center">
                <h3 class="fw-bold text-white">Purchase Report</h3>
            </div>
        </div>
        
        <!-- Collapsible Search Options -->
        <div class="card mb-3 shadow-sm">
            <div class="card-header py-2" role="button" data-bs-toggle="collapse" data-bs-target="#searchOptionsCollapse" aria-expanded="false" aria-controls="searchOptionsCollapse">
                <div class="d-flex justify-content-between align-items-center">
                    <h6 class="mb-0"><i class="fas fa-search me-2"></i>Search Options</h6>
                    <i class="fas fa-chevron-down"></i>
                </div>
            </div>
            <div class="collapse" id="searchOptionsCollapse">
                <div class="card-body py-2">
                    <!-- First Row -->
                    <div class="row g-2 mb-2">
                        <div class="col-md-4">
                            <div class="form-group">
                                <label class="form-label small fw-bold">Purchase No</label>
                                <select wire:model="search_purchase_no" class="form-select form-select-sm">
                                    <option value="">Select Purchase No</option>
                                    @foreach($purchases as $purchase)
                                    <option value="{{ $purchase->purchase_no }}">{{ $purchase->purchase_no }}</option>
                                    @endforeach
                                </select>
                            </div>
                        </div>
                        
                        <div class="col-md-4">
                            <div class="form-group">
                                <label class="form-label small fw-bold">Purchase Date</label>
                                <select wire:model="search_purchase_date" class="form-select form-select-sm">
                                    <option value="">Select Date</option>
                                    @foreach($purchases as $purchase)
                                    <option value="{{ $purchase->purchase_date }}">{{ $purchase->purchase_date }}</option>
                                    @endforeach
                                </select>
                            </div>
                        </div>
                        
                        <div class="col-md-4">
                            <div class="form-group">
                                <label class="form-label small fw-bold">Supplier</label>
                                <select wire:model="search_supplier_name" class="form-select form-select-sm">
                                    <option value="">Select Supplier</option>
                                    @foreach($purchases as $purchase)
                                    <option value="{{ $purchase->supplier->name ?? 'N/A' }}">{{ $purchase->supplier->name ?? 'N/A' }}</option>
                                    @endforeach
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Second Row -->
                    <div class="row g-2">
                        <div class="col-md-4">
                            <div class="form-group">
                                <label class="form-label small fw-bold">ID Range</label>
                                <div class="input-group input-group-sm">
                                    <input type="number" class="form-control form-control-sm" wire:model="searchFromId" placeholder="From">
                                    <input type="number" class="form-control form-control-sm" wire:model="searchToId" placeholder="To">
                                </div>
                            </div>
                        </div>
                        
                        <div class="col-md-4">
                            <div class="form-group">
                                <label class="form-label small fw-bold">Date Range</label>
                                <div class="input-group input-group-sm">
                                    <input type="date" wire:model="searchFromDate" class="form-control form-control-sm">
                                    <span class="input-group-text">to</span>
                                    <input type="date" wire:model="searchToDate" class="form-control form-control-sm">
                                </div>
                            </div>
                        </div>

                        <div class="col-md-3">
                            <div class="form-group">
                                <label class="form-label small fw-bold">&nbsp;</label>
                                <div class="d-flex gap-2">
                                    <button wire:click="searchDetails" class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#searchModal">
                                        <i data-feather="search" class="icon-sm"></i> Search
                                    </button>
                                    <button wire:click="clearSearch" class="btn btn-danger btn-sm">
                                        <i data-feather="x-circle" class="icon-sm"></i> Clear
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Details Modal for single purchase -->
        <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog" aria-labelledby="detailsModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-lg" role="document">
                <div class="modal-content">
                    <!-- Header -->
                    <div class="modal-header text-white">
                        <h5 class="modal-title" id="detailsModalLabel">Purchase Details</h5>
                        <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
                    </div>

                    <!-- Body -->
                    <div class="modal-body p-2">
                        @if($selectedPurchase)
                            <div class="row g-3">
                                <div class="col-md-4">
                                    <div class="p-3 rounded border">
                                        <strong>Purchase No:</strong> {{ $selectedPurchase->purchase_no }}
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="p-3 rounded border">
                                        <strong>Purchase Date:</strong> {{ $selectedPurchase->purchase_date }}
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="p-3 rounded border">
                                        <strong>Supplier Name:</strong> {{ $selectedPurchase->supplier->name ?? 'N/A' }}
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="p-3 rounded border">
                                        <strong>Total Amount:</strong> {{ $selectedPurchase->total_amount }}
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="p-3 rounded border">
                                        <strong>Total Discount:</strong> {{ $selectedPurchase->total_discount }}
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="p-3 rounded border">
                                        <strong>Total Quantity:</strong> {{ $selectedPurchase->total_quantity }}
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="p-3 rounded border">
                                        <strong>Net Amount:</strong> {{ $selectedPurchase->net_amount }}
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="p-3 rounded border">
                                        <strong>Paid Amount:</strong> {{ $selectedPurchase->paid_amount }}
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="p-3 rounded border">
                                        <strong>Due Amount:</strong> {{ $selectedPurchase->due_amount }}
                                    </div>
                                </div>
                                <div class="col-md-4">
                                    <div class="p-3 rounded border">
                                        <strong>Created By:</strong> {{ $selectedPurchase->user->name ?? 'N/A' }}
                                    </div>
                                </div>
                            </div>
                            
                            <h5 class="mt-4">Purchase Items</h5>
                            <div class="table-responsive">
                                <table class="table table-bordered">
                                    <thead>
                                        <tr>
                                            <th>S.No</th>
                                            <th>Product</th>
                                            <th>Batch No</th>
                                            <th>Expiry Date</th>
                                            <th>Quantity</th>
                                            <th>Unit Price</th>
                                            <th>Discount</th>
                                            <th>Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @forelse($selectedPurchase->purchaseDetails as $key => $detail)
                                            <tr>
                                                <td>{{ $key + 1 }}</td>
                                                <td>{{ $detail->product->name ?? 'N/A' }}</td>
                                                <td>{{ $detail->batch_no }}</td>
                                                <td>{{ $detail->expiry_date }}</td>
                                                <td>{{ $detail->quantity }}</td>
                                                <td>{{ $detail->unit_price }}</td>
                                                <td>{{ $detail->discount }}</td>
                                                <td>{{ $detail->amount }}</td>
                                            </tr>
                                        @empty
                                            <tr>
                                                <td colspan="8" class="text-center">No items found</td>
                                            </tr>
                                        @endforelse
                                    </tbody>
                                </table>
                            </div>
                        @endif
                    </div>
                </div>
            </div>
        </div>

        <!-- Table displaying Purchase details -->
        <div class="table-responsive">
            <table class="table table-bordered">
                <thead>
                    <tr>
                        <th>S.No</th>
                        <th>Purchase No</th>
                        <th>Supplier Name</th>
                        <th>Date</th>
                        <th>Net Amount</th>
                        <th>Paid Amount</th>
                        <th>Due Amount</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($purchases as $key => $purchase)
                    <tr>
                        <td>{{ $key + 1 }}</td>
                        <td>{{ $purchase->purchase_no }}</td>
                        <td>{{ $purchase->supplier->name ?? 'N/A' }}</td>
                        <td>{{ $purchase->purchase_date }}</td>
                        <td>{{ $purchase->net_amount }}</td>
                        <td>{{ $purchase->paid_amount }}</td>
                        <td>{{ $purchase->due_amount }}</td>
                        <td>
                            <button wire:click="showDetails({{ $purchase->id }})" class="btn btn-icon-text btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#detailsModal">
                                <i class="btn-icon-prepend" data-feather="info"></i>Details
                            </button>
                        </td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
        </div>

        <!-- Pagination Links -->
        {{ $purchases->links() }}
    </div>

    <!-- Search Purchase Modal -->
    <div wire:ignore.self class="modal fade" id="searchModal" tabindex="-1" role="dialog" aria-labelledby="searchModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl" role="document">
            <div class="modal-content">
                <!-- Header -->
                <div class="modal-header text-white">
                    <h5 class="modal-title" id="searchModalLabel">Purchase Details</h5>
                    <div class="col-md-3 text-end">
                        <div class="btn-group" role="group">
                            <button class="btn btn-outline-success btn-icon-text btn-sm" wire:click="excel">Excel</button>
                            <button class="btn btn-outline-danger btn-icon-text btn-sm" wire:click="pdf">PDF</button>
                            <button class="btn btn-outline-secondary btn-icon-text btn-sm" onclick="window.open('{{ url('/pharmacy/purchase-report-print') }}', '_blank')">Print</button>
                        </div>
                    </div>
                    <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeSearchModal"></button>
                </div>
                <!-- Body -->
                <div class="modal-body p-2" style="max-height: 400px; overflow-y: auto;">
                    <div class="table-responsive">
                        <table class="table table-bordered">
                            <thead>
                                <tr>
                                    <th>S.No</th>
                                    <th>Purchase No</th>
                                    <th>Supplier Name</th>
                                    <th>Purchase Date</th>
                                    <th>Net Amount</th>
                                    <th>Paid Amount</th>
                                    <th>Due Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse($searchResults as $key => $purchase)
                                <tr>
                                    <td>{{ $key + 1 }}</td>
                                    <td>{{ $purchase->purchase_no }}</td>
                                    <td>{{ $purchase->supplier->name ?? 'N/A' }}</td>
                                    <td>{{ $purchase->purchase_date }}</td>
                                    <td>{{ $purchase->net_amount }}</td>
                                    <td>{{ $purchase->paid_amount }}</td>
                                    <td>{{ $purchase->due_amount }}</td>
                                </tr>
                                @empty
                                <tr>
                                    <td colspan="7" class="text-center">No Purchase records found.</td>
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

    <!-- Modal Event Listeners -->
    <script>
        document.addEventListener('livewire:load', function() {
            window.addEventListener('open-modal', (event) => {
                var modal = new bootstrap.Modal(document.getElementById(event.detail));
                modal.show();
            });

            window.addEventListener('close-modal', (event) => {
                var modal = bootstrap.Modal.getInstance(document.getElementById(event.detail));
                if (modal) {
                    modal.hide();
                }
            });
            
            window.addEventListener('open-search-modal', () => {
                var modal = new bootstrap.Modal(document.getElementById('searchModal'));
                modal.show();
            });
        });

        window.addEventListener('save-modal', () => {
            var modal = bootstrap.Modal.getInstance(document.getElementById('detailsModal'));
            if (modal) {
                modal.hide();
            }
        });
    </script>
</div>