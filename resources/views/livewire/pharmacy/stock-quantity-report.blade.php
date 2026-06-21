<div class="container">
    <!-- Page title and Search dropdowns -->
    <div class="row mb-2">
        <div class="col-md-12 text-start">
            <h3>Stock Quantity Report</h3>
        </div>
    </div>

    <!-- Stock Status Overview Cards -->
    <div class="row mb-3">
        <div class="col-md-3">
            <div class="card border-danger">
                <div class="card-body bg-danger bg-opacity-10">
                    <h5 class="card-title text-danger">Out of Stock</h5>
                    <p class="card-text">{{ $outOfStockCount }} items</p>
                    <p class="small text-muted">Quantity is zero</p>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card border-warning">
                <div class="card-body bg-warning bg-opacity-10">
                    <h5 class="card-title text-warning">Low Stock</h5>
                    <p class="card-text">{{ $lowStockCount }} items</p>
                    <p class="small text-muted">Below reorder level</p>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card border-success">
                <div class="card-body bg-success bg-opacity-10">
                    <h5 class="card-title text-success">Adequate Stock</h5>
                    <p class="card-text">{{ $adequateStockCount }} items</p>
                    <p class="small text-muted">Between reorder level and ideal stock</p>
                </div>
            </div>
        </div>
        <div class="col-md-3">
            <div class="card border-info">
                <div class="card-body bg-info bg-opacity-10">
                    <h5 class="card-title text-info">Overstocked</h5>
                    <p class="card-text">{{ $overStockCount }} items</p>
                    <p class="small text-muted">Above ideal stock level</p>
                </div>
            </div>
        </div>
    </div>

    <!-- Search Filters -->
    <div class="row mb-2">
        <div class="col-md-3">
            <label class="form-label"><small>Dynamic Search</small></label>
            <input type="text" wire:model.live="search" class="form-control" placeholder="Type here...">
        </div>

        <div class="col-md-3">
            <label class="form-label"><small>Search by Product</small></label>
            <select wire:model="searchByProduct" class="form-control">
                <option value="">Select Product</option>
                @foreach($products as $product)
                <option value="{{ $product->id }}">{{ $product->name }}</option>
                @endforeach
            </select>
        </div>
        <div class="col-md-3">
            <label class="form-label"><small>Stock Status</small></label>
            <select wire:model="searchByStockStatus" class="form-control">
                <option value="">All Status</option>
                <option value="Out of Stock">Out of Stock</option>
                <option value="Low Stock">Low Stock</option>
                <option value="Adequate">Adequate</option>
                <option value="Overstocked">Overstocked</option>
            </select>
        </div>
        <div class="col-md-3 text-end" style="margin-top: 32px;">
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

    <!-- Table displaying Stock Quantity details -->
    <div class="table-responsive">
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th wire:click="sortBy('product_id')" class="cursor-pointer">
                        ID 
                        @if($sortField === 'product_id')
                            <i class="mdi mdi-{{ $sortDirection === 'asc' ? 'sort-ascending' : 'sort-descending' }}"></i>
                        @endif
                    </th>
                    <th wire:click="sortBy('product_name')" class="cursor-pointer">
                        Product 
                        @if($sortField === 'product_name')
                            <i class="mdi mdi-{{ $sortDirection === 'asc' ? 'sort-ascending' : 'sort-descending' }}"></i>
                        @endif
                    </th>
                    <th wire:click="sortBy('total_quantity')" class="cursor-pointer">
                        Quantity
                        @if($sortField === 'total_quantity')
                            <i class="mdi mdi-{{ $sortDirection === 'asc' ? 'sort-ascending' : 'sort-descending' }}"></i>
                        @endif
                    </th>
                    <th wire:click="sortBy('status')" class="cursor-pointer">
                        Status
                        @if($sortField === 'status')
                            <i class="mdi mdi-{{ $sortDirection === 'asc' ? 'sort-ascending' : 'sort-descending' }}"></i>
                        @endif
                    </th>
                    <th>Stock Level</th>
                    @if(Auth::user()->can('stock.details'))
                    <th>Action</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($stocks as $stock)
                <tr>
                    <td>{{ $stock->product_id }}</td>
                    <td>{{ $stock->product_name }}</td>
                    <td>{{ $stock->total_quantity }}</td>
                    <td class="{{ $stock->status_class }}">{{ $stock->status }}</td>
                    <td>
                        <div class="progress" style="height: 20px;">
                            @php
                                $percentage = 0;
                                $barClass = 'bg-danger';
                                
                                if ($stock->total_quantity <= 0) {
                                    $percentage = 0;
                                    $barClass = 'bg-danger';
                                } elseif ($stock->status == 'Low Stock') {
                                    $percentage = 25;
                                    $barClass = 'bg-warning';
                                } elseif ($stock->status == 'Adequate') {
                                    $percentage = 70;
                                    $barClass = 'bg-success';
                                } else {
                                    $percentage = 100;
                                    $barClass = 'bg-info';
                                }
                            @endphp
                            <div class="progress-bar {{ $barClass }}" role="progressbar" style="width: {{ $percentage }}%;" aria-valuenow="{{ $percentage }}" aria-valuemin="0" aria-valuemax="100">{{ $percentage }}%</div>
                        </div>
                    </td>
                    @if(Auth::user()->can('stock.details'))
                    <td>
                        <button wire:click="showDetails({{ $stock->product_id }})" class="btn btn-outline-info btn-sm">
                            <i class="btn-icon-prepend" data-feather="info" style="width: 16px; height: 16px;"></i> Details
                        </button>
                    </td>
                    @endif
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <!-- Stock Details Modal -->
    <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog" aria-labelledby="detailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl" role="document">
            <div class="modal-content">
                <!-- Header -->
                <div class="modal-header text-white">
                    <h5 class="modal-title" id="detailsModalLabel">Product Stock Details</h5>
                    <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
                </div>
                <!-- Body -->
                <div class="modal-body p-2">
                    @if($selectedStock && $selectedStock->count() > 0)
                    <!-- Stock Information -->
                    <h5>{{ $selectedStock->first()->product->name ?? 'N/A' }}</h5>
                    
                    <div class="table-responsive mt-3">
                        <table class="table table-bordered">
                            <thead>
                                <tr>
                                    <th>Batch No</th>
                                    <th>Quantity</th>
                                    <th>Mfg Date</th>
                                    <th>Expiry Date</th>
                                    <th>Unit Price</th>
                                    <th>Created By</th>
                                    <th>Created At</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach($selectedStock as $item)
                                <tr>
                                    <td>{{ $item->batch_no }}</td>
                                    <td>{{ $item->quantity }}</td>
                                    <td>{{ $item->mfg_date ? date('d-m-Y', strtotime($item->mfg_date)) : 'N/A' }}</td>
                                    <td>{{ $item->expiry_date ? date('d-m-Y', strtotime($item->expiry_date)) : 'N/A' }}</td>
                                    <td>{{ $item->unit_price }}</td>
                                    <td>{{ $item->user->name ?? 'N/A' }}</td>
                                    <td>{{ $item->created_at->format('d-m-Y') }}</td>
                                </tr>
                                @endforeach
                            </tbody>
                        </table>
                    </div>
                    
                    @else
                    <div class="alert alert-info">No stock details available.</div>
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
                    <h5 class="modal-title" id="searchModalLabel">Stock Quantity Report</h5>
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
                                <th>Quantity</th>
                                <th>Status</th>
                                <th>Stock Level</th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse($searchResults as $stock)
                            <tr>
                                <td>{{ $stock->product_id }}</td>
                                <td>{{ $stock->product_name }}</td>
                                <td>{{ $stock->total_quantity }}</td>
                                <td class="{{ $stock->status_class }}">{{ $stock->status }}</td>
                                <td>
                                    <div class="progress" style="height: 20px;">
                                        @php
                                            $percentage = 0;
                                            $barClass = 'bg-danger';
                                            
                                            if ($stock->total_quantity <= 0) {
                                                $percentage = 0;
                                                $barClass = 'bg-danger';
                                            } elseif ($stock->status == 'Low Stock') {
                                                $percentage = 25;
                                                $barClass = 'bg-warning';
                                            } elseif ($stock->status == 'Adequate') {
                                                $percentage = 70;
                                                $barClass = 'bg-success';
                                            } else {
                                                $percentage = 100;
                                                $barClass = 'bg-info';
                                            }
                                        @endphp
                                        <div class="progress-bar {{ $barClass }}" role="progressbar" style="width: {{ $percentage }}%;" aria-valuenow="{{ $percentage }}" aria-valuemin="0" aria-valuemax="100">{{ $percentage }}%</div>
                                    </div>
                                </td>
                            </tr>
                            @empty
                            <tr>
                                <td colspan="5" class="text-center">No records found.</td>
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
</script>