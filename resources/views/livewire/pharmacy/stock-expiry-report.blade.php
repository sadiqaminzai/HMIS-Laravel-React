<div class="container">
    <!-- Page title and Search dropdowns -->
    <div class="row mb-2">
        <div class="col-md-12 text-start">
            <h3>Stock Expiry Report</h3>
        </div>
    </div>

    <!-- Expiry Status Overview Cards -->
    <div class="row mb-3">
        <div class="col-md-3">
            <div class="card border-danger">
                <div class="card-body bg-danger bg-opacity-10">
                    <h5 class="card-title text-danger">Expired</h5>
                    <p class="card-text">{{ $expiredCount }} items</p>
                    <p class="small text-muted">Expiration date is in the past</p>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card border-warning">
                <div class="card-body bg-warning bg-opacity-10">
                    <h5 class="card-title text-warning">About to Expire</h5>
                    <p class="card-text">{{ $aboutToExpireCount }} items</p>
                    <p class="small text-muted">Expires within 30 days</p>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card border-info">
                <div class="card-body bg-info bg-opacity-10">
                    <h5 class="card-title text-info">Near Expiration</h5>
                    <p class="card-text">{{ $nearExpirationCount }} items</p>
                    <p class="small text-muted">Expires within 31-60 days</p>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card border-success">
                <div class="card-body bg-success bg-opacity-10">
                    <h5 class="card-title text-success">Good Condition</h5>
                    <p class="card-text">{{ $goodConditionCount }} items</p>
                    <p class="small text-muted">Expires after 60+ days</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Search Filters -->
    <div class="row mb-2">
        <div class="col-md-2">
            <label class="form-label"><small>Dynamic Search</small></label>
            <input type="text" wire:model.live="search" class="form-control" placeholder="Type here...">
        </div>

        <div class="col-md-2">
            <label class="form-label"><small>Search by Product</small></label>
            <select wire:model="searchByProduct" class="form-control">
                <option value="">Select Product</option>
                @foreach($products as $product)
                <option value="{{ $product->id }}">{{ $product->name }}</option>
                @endforeach
            </select>
        </div>
        <div class="col-md-2">
            <label class="form-label"><small>Search by Batch No</small></label>
            <select wire:model="searchByBatchNo" class="form-control">
                <option value="">Select Batch No</option>
                @foreach($stocks->unique('batch_no') as $stock)
                <option value="{{ $stock->batch_no }}">{{ $stock->batch_no }}</option>
                @endforeach
            </select>
        </div>
        <div class="col-md-2">
            <label class="form-label"><small>Expiry Status</small></label>
            <select wire:model="searchByExpiryStatus" class="form-control">
                <option value="">All Status</option>
                <option value="expired">Expired</option>
                <option value="about_to_expire">About to Expire</option>
                <option value="near_expiration">Near Expiration</option>
                <option value="good_condition">Good Condition</option>
            </select>
        </div>
        <div class="col-md-2">
            <label class="form-label"><small>Expiry Date Range</small></label>
            <div class="input-group">
                <input type="date" wire:model="searchFromDate" class="form-control" placeholder="From Date">
                <input type="date" wire:model="searchToDate" class="form-control" placeholder="To Date">
            </div>
        </div>
        <div class="col-md-2 text-end" style="margin-top: 32px;">
            <div class="btn-group" role="group">
                <button wire:click="searchDetails" class="btn btn-outline-info btn-sm">
                    <i class="btn-icon-prepend" data-feather="info" style="width: 16px; height: 16px;"></i> Search
                </button>
                <button class="btn btn-outline-secondary btn-icon-text btn-sm" wire:click="resetFilters">
                    <i class="btn-icon-prepend" data-feather="refresh-cw"></i>Reset
                </button>
            </div>
        </div>
    </div>

    <!-- Table displaying Stock details -->
    <div class="table-responsive">
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Product</th>
                    <th>Batch No</th>
                    <th>Qty</th>
                    <th>Mfg Date</th>
                    <th>Expiry Date</th>
                    <th>Days</th>
                    <th>Status</th>
                    <th>Created At</th>
                    @if(Auth::user()->can('stock.details'))
                    <th>Action</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($stocks as $stock)
                @php
                    $today = \Carbon\Carbon::today();
                    $expiryDate = \Carbon\Carbon::parse($stock->expiry_date);
                    $daysRemaining = $today->diffInDays($expiryDate, false);
                    
                    $statusClass = 'text-success';
                    $status = 'Good Condition';
                    
                    if ($daysRemaining < 0) {
                        $statusClass = 'text-danger';
                        $status = 'Expired';
                    } elseif ($daysRemaining <= 30) {
                        $statusClass = 'text-warning';
                        $status = 'About to Expire';
                    } elseif ($daysRemaining <= 60) {
                        $statusClass = 'text-info';
                        $status = 'Near Expiration';
                    }
                @endphp
                <tr>
                    <td>{{ $stock->id }}</td>
                    <td>{{ $stock->product->name ?? 'N/A' }}</td>
                    <td>{{ $stock->batch_no }}</td>
                    <td>{{ $stock->quantity }}</td>
                    <td>{{ $stock->mfg_date ? date('d-m-Y', strtotime($stock->mfg_date)) : 'N/A' }}</td>
                    <td>{{ $stock->expiry_date ? date('d-m-Y', strtotime($stock->expiry_date)) : 'N/A' }}</td>
                    <td>{{ $daysRemaining > 0 ? $daysRemaining : 0 }}</td>
                    <td class="{{ $statusClass }}">{{ $status }}</td>
                    <td>{{ $stock->created_at->format('d-m-Y') }}</td>

                    <!-- Action buttons for viewing details -->
                    @if(Auth::user()->can('stock.details'))
                    <td>
                        <button wire:click="showDetails({{ $stock->id }})" class="btn btn-outline-info btn-sm" data-bs-toggle="modal" data-bs-target="#detailsModal">
                            <i class="btn-icon-prepend" data-feather="info" style="width: 16px; height: 16px;"></i> Details
                        </button>
                    </td>
                    @endif
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <!-- Pagination Links -->
    @if(!$search) {{ $stocks->links() }} @endif

    <!-- Stock Details Modal -->
    <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog" aria-labelledby="detailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <!-- Header -->
                <div class="modal-header text-white">
                    <h5 class="modal-title" id="detailsModalLabel">Stock Details</h5>
                    <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
                </div>
                <!-- Body -->
                <div class="modal-body p-2">
                    @if($selectedStock)
                    <!-- Stock Information in Two-Column Grid -->
                    <div class="row g-3">
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Product:</strong> {{ $selectedStock->product->name ?? 'N/A' }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Batch No:</strong> {{ $selectedStock->batch_no }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Quantity:</strong> {{ $selectedStock->quantity }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Manufacturing Date:</strong> {{ $selectedStock->mfg_date ? date('d-m-Y', strtotime($selectedStock->mfg_date)) : 'N/A' }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Expiry Date:</strong> {{ $selectedStock->expiry_date ? date('d-m-Y', strtotime($selectedStock->expiry_date)) : 'N/A' }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                @php
                                $today = \Carbon\Carbon::today();
                                $expiryDate = \Carbon\Carbon::parse($selectedStock->expiry_date);
                                $daysRemaining = $today->diffInDays($expiryDate, false);
                                
                                $statusClass = 'text-success';
                                $status = 'Good Condition';
                                
                                if ($daysRemaining < 0) {
                                    $statusClass = 'text-danger';
                                    $status = 'Expired';
                                } elseif ($daysRemaining <= 30) {
                                    $statusClass = 'text-warning';
                                    $status = 'About to Expire';
                                } elseif ($daysRemaining <= 60) {
                                    $statusClass = 'text-info';
                                    $status = 'Near Expiration';
                                }
                                @endphp
                                <strong>Expiry Status:</strong> <span class="{{ $statusClass }}">{{ $status }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Days Remaining:</strong> {{ $daysRemaining > 0 ? $daysRemaining : 0 }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Unit Price:</strong> {{ $selectedStock->unit_price }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Bonus:</strong> {{ $selectedStock->bonus ?? 'N/A' }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Discount:</strong> {{ $selectedStock->discount ?? 'N/A' }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Amount:</strong> {{ $selectedStock->amount ?? 'N/A' }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Created By:</strong> {{ $selectedStock->user->name ?? 'N/A' }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Created At:</strong> {{ $selectedStock->created_at->format('d-m-Y H:i:s') }}
                            </div>
                        </div>
                    </div>
                    @endif
                </div>

                <!-- Footer -->
                <div class="modal-footer d-flex justify-content-end">
                    <button type="button" class="btn btn-outline-secondary btn-icon-text btn-sm" data-bs-dismiss="modal">
                        Close
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Search Result Modal -->
    <div wire:ignore.self class="modal fade" id="searchModal" tabindex="-1" role="dialog" aria-labelledby="searchModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl" role="document">
            <div class="modal-content">
                <!-- Header -->
                <div class="modal-header text-white">
                    <h5 class="modal-title" id="searchModalLabel">Stock Expiry Report</h5>
                    <div class="col-md-3 text-end">
                        <div class="btn-group" role="group">
                            <button class="btn btn-outline-success btn-icon-text btn-sm" wire:click="excel">Excel</button>
                            <button class="btn btn-outline-danger btn-icon-text btn-sm" wire:click="pdf">PDF</button>
                            <button class="btn btn-outline-secondary btn-icon-text btn-sm" wire:click="print">Print</button>
                        </div>
                    </div>
                    <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeSearchModal"></button>
                </div>
                <!-- Body -->
                <div class="modal-body p-2" style="max-height: 400px; overflow-y: auto;">
                    <table class="table table-bordered">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Product</th>
                                <th>Batch No</th>
                                <th>Qty</th>
                                <th>Mfg Date</th>
                                <th>Expiry Date</th>
                                <th>Days</th>
                                <th>Status</th>
                                <th>Created At</th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse($searchResults as $stock)
                            @php
                                $today = \Carbon\Carbon::today();
                                $expiryDate = \Carbon\Carbon::parse($stock->expiry_date);
                                $daysRemaining = $today->diffInDays($expiryDate, false);
                                
                                $statusClass = 'text-success';
                                $status = 'Good Condition';
                                
                                if ($daysRemaining < 0) {
                                    $statusClass = 'text-danger';
                                    $status = 'Expired';
                                } elseif ($daysRemaining <= 30) {
                                    $statusClass = 'text-warning';
                                    $status = 'About to Expire';
                                } elseif ($daysRemaining <= 60) {
                                    $statusClass = 'text-info';
                                    $status = 'Near Expiration';
                                }
                            @endphp
                            <tr>
                                <td>{{ $stock->id }}</td>
                                <td>{{ $stock->product->name ?? 'N/A' }}</td>
                                <td>{{ $stock->batch_no }}</td>
                                <td>{{ $stock->quantity }}</td>
                                <td>{{ $stock->mfg_date ? date('d-m-Y', strtotime($stock->mfg_date)) : 'N/A' }}</td>
                                <td>{{ $stock->expiry_date ? date('d-m-Y', strtotime($stock->expiry_date)) : 'N/A' }}</td>
                                <td>{{ $daysRemaining > 0 ? $daysRemaining : 0 }}</td>
                                <td class="{{ $statusClass }}">{{ $status }}</td>
                                <td>{{ $stock->created_at->format('d-m-Y') }}</td>
                            </tr>
                            @empty
                            <tr>
                                <td colspan="9" class="text-center">No records found.</td>
                            </tr>
                            @endforelse
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>
</div>

<!-- Modal Event Listeners -->
<script>
    document.addEventListener('livewire:initialized', function() {
        // Livewire v3 event listeners
        Livewire.on('open-modal', (modalId) => {
            var modalElement = document.getElementById(modalId);
            if (modalElement) {
                var modal = new bootstrap.Modal(modalElement);
                modal.show();
            } else {
                console.error('Modal element not found:', modalId);
            }
        });

        Livewire.on('close-modal', (modalId) => {
            var modalElement = document.getElementById(modalId);
            if (modalElement) {
                var modal = bootstrap.Modal.getInstance(modalElement);
                if (modal) modal.hide();
            }
        });
    });

    // Keep the print event listener as it is
    window.addEventListener('print-stock-expiry-report', event => {
        var printWindow = window.open("{{ url('/pharmacy/stock-expiry-report-print') }}", "_blank");
        printWindow.focus();
        printWindow.onload = function() {
            // Not auto-printing, just opening the page with print button
        };
    });
</script>