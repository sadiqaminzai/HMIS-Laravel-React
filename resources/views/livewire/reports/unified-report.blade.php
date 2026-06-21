<div>
    <div class="card shadow-sm">
        <div class="card-header bg-transparent py-3">
            <div class="row">
                <div class="col">
                    <h4 class="mb-0">Unified Report</h4>
                </div>
                <div class="col-auto d-flex gap-3">
                    <div>
                        <button class="btn btn-sm btn-outline-primary" type="button" data-bs-toggle="collapse" data-bs-target="#filterSection" aria-expanded="false" aria-controls="filterSection">
                            <i class="fas fa-filter me-1"></i>Filters
                        </button>
                    </div>
                    <select wire:model.live="perPage" class="form-select form-select-sm" style="width: 5rem">
                        <option value="10">10</option>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </select>
                    <div>
                        <button wire:click="resetFilters" class="btn btn-sm btn-outline-secondary" type="button">
                            <i class="fas fa-eraser me-1"></i>Clear
                        </button>
                    </div>
                    <div>
                        <a wire:navigate href="{{ route('reports.unified.print') }}" wire:click="print" target="_blank" class="btn btn-sm btn-primary" type="button">
                            <i class="fas fa-print me-1"></i>Print
                        </a>
                    </div>
                    <div>
                        <button wire:click="pdf" class="btn btn-sm btn-danger" type="button">
                            <i class="fas fa-file-pdf me-1"></i>PDF
                        </button>
                    </div>
                    <div>
                        <button wire:click="excel" class="btn btn-sm btn-success" type="button">
                            <i class="fas fa-file-excel me-1"></i>Excel
                        </button>
                    </div>
                </div>
            </div>
        </div>
        <div class="card-body pb-0">
            <!-- Filters -->
            <div class="collapse mb-4" id="filterSection">
                <div class="card card-body">
                    <div class="row g-3">
                        <div class="col-md-3">
                            <div class="form-group mb-3">
                                <label for="report_type" class="form-label">Report Type</label>
                                <select wire:model.live="report_type" class="form-select">
                                    <option value="all">All</option>
                                    <option value="fee">Fee Receipts</option>
                                    <option value="service">Service Receipts</option>
                                    <option value="sale">Sale Invoices</option>
                                    <option value="return">Return Invoices</option>
                                    <option value="purchase">Purchases</option>
                                </select>
                            </div>
                        </div>
                       

                        <div class="col-md-3">
                            <div class="form-group mb-3">
                                <label for="searchFromDate" class="form-label">From Date</label>
                                <input type="date" wire:model.live="searchFromDate" class="form-control">
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group mb-3">
                                <label for="searchToDate" class="form-label">To Date</label>
                                <input type="date" wire:model.live="searchToDate" class="form-control">
                            </div>
                        </div>

                        <div class="col-md-3">
                            <div class="form-group mb-3">
                                <label for="searchById" class="form-label">ID/Number</label>
                                <input type="text" wire:model.live="searchById" class="form-control" placeholder="Search by ID...">
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group mb-3">
                                <label for="searchByPatient" class="form-label">Patient</label>
                                <input type="text" wire:model.live="searchByPatient" class="form-control" placeholder="Search by patient...">
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group mb-3">
                                <label for="searchByDoctor" class="form-label">Doctor</label>
                                <input type="text" wire:model.live="searchByDoctor" class="form-control" placeholder="Search by doctor...">
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group mb-3">
                                <label for="searchBySupplier" class="form-label">Supplier</label>
                                <input type="text" wire:model.live="searchBySupplier" class="form-control" placeholder="Search by supplier...">
                            </div>
                        </div>

                        <div class="col-md-3">
                            <div class="form-group mb-3">
                                <label for="search_payment_status" class="form-label">Payment Status</label>
                                <select wire:model.live="search_payment_status" class="form-select">
                                    <option value="">All</option>
                                    <option value="Paid">Paid</option>
                                    <option value="Partial">Partial</option>
                                    <option value="Due">Due</option>
                                </select>
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group mb-3">
                                <label for="search_payment_method" class="form-label">Payment Method</label>
                                <select wire:model.live="search_payment_method" class="form-select">
                                    <option value="">All</option>
                                    <option value="Cash">Cash</option>
                                    <option value="Bank">Bank</option>
                                    <option value="Card">Card</option>
                                    <option value="Mobile">Mobile</option>
                                </select>
                            </div>
                        </div>

                        <div class="col-md-3">
                            <div class="form-group mb-3">
                                <label for="searchFromId" class="form-label">From ID</label>
                                <input type="text" wire:model.live="searchFromId" class="form-control" placeholder="From ID...">
                            </div>
                        </div>
                        <div class="col-md-3">
                            <div class="form-group mb-3">
                                <label for="searchToId" class="form-label">To ID</label>
                                <input type="text" wire:model.live="searchToId" class="form-control" placeholder="To ID...">
                            </div>
                        </div>
                    </div>
                    
                    <!-- Active filters display -->
                    <div class="active-filters mt-2">
                        <div class="d-flex flex-wrap gap-2 align-items-center">
                            @if($report_type != 'all' || $searchFromDate || $searchToDate || $searchById || $searchByPatient || $searchByDoctor || $searchBySupplier || $search_payment_status || $search_payment_method || $searchFromId || $searchToId)
                                <div><strong>Active filters:</strong></div>
                                @if($report_type != 'all')
                                    <span class="badge bg-info">Type: {{ ucfirst($report_type) }}</span>
                                @endif
                                @if($searchFromDate)
                                    <span class="badge bg-info">From: {{ $searchFromDate }}</span>
                                @endif
                                @if($searchToDate)
                                    <span class="badge bg-info">To: {{ $searchToDate }}</span>
                                @endif
                                @if($searchById)
                                    <span class="badge bg-info">ID: {{ $searchById }}</span>
                                @endif
                                @if($searchByPatient)
                                    <span class="badge bg-info">Patient: {{ $searchByPatient }}</span>
                                @endif
                                @if($searchByDoctor)
                                    <span class="badge bg-info">Doctor: {{ $searchByDoctor }}</span>
                                @endif
                                @if($searchBySupplier)
                                    <span class="badge bg-info">Supplier: {{ $searchBySupplier }}</span>
                                @endif
                                @if($search_payment_status)
                                    <span class="badge bg-info">Status: {{ $search_payment_status }}</span>
                                @endif
                                @if($search_payment_method)
                                    <span class="badge bg-info">Method: {{ $search_payment_method }}</span>
                                @endif
                                @if($searchFromId)
                                    <span class="badge bg-info">From ID: {{ $searchFromId }}</span>
                                @endif
                                @if($searchToId)
                                    <span class="badge bg-info">To ID: {{ $searchToId }}</span>
                                @endif
                            @endif
                        </div>
                    </div>
                </div>
            </div>

            <!-- Summary Boxes -->
            <div class="row mb-4">
                <div class="col-md-2">
                    <div class="card border-0 shadow-sm mb-2" style="background: linear-gradient(to bottom right, #0d6efd, #0dcaf0); height: 120px;">
                        <div class="card-body text-center d-flex flex-column justify-content-center align-items-center h-100 py-3">
                            <h6 class="card-title text-white mb-2"><i class="fas fa-money-bill-wave me-2"></i>Total Amount</h6>
                            <p class="card-text text-white fs-4 fw-bold mb-0">{{ number_format($totalAmount, 2) }}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="card border-0 shadow-sm mb-2" style="background: linear-gradient(to bottom right, #ffc107, #fd7e14); height: 120px;">
                        <div class="card-body text-center d-flex flex-column justify-content-center align-items-center h-100 py-3">
                            <h6 class="card-title text-white mb-2"><i class="fas fa-percent me-2"></i>Total Discount</h6>
                            <p class="card-text text-white fs-4 fw-bold mb-0">{{ number_format($totalDiscount, 2) }}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="card border-0 shadow-sm mb-2" style="background: linear-gradient(to bottom right, #198754, #20c997); height: 120px;">
                        <div class="card-body text-center d-flex flex-column justify-content-center align-items-center h-100 py-3">
                            <h6 class="card-title text-white mb-2"><i class="fas fa-hand-holding-usd me-2"></i>Net Amount</h6>
                            <p class="card-text text-white fs-4 fw-bold mb-0">{{ number_format($totalNetAmount, 2) }}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="card border-0 shadow-sm mb-2" style="background: linear-gradient(to bottom right, #0d6efd, #6610f2); height: 120px;">
                        <div class="card-body text-center d-flex flex-column justify-content-center align-items-center h-100 py-3">
                            <h6 class="card-title text-white mb-2"><i class="fas fa-check-circle me-2"></i>Paid Amount</h6>
                            <p class="card-text text-white fs-4 fw-bold mb-0">{{ number_format($totalPaidAmount, 2) }}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="card border-0 shadow-sm mb-2" style="background: linear-gradient(to bottom right, #dc3545, #fd7e14); height: 120px;">
                        <div class="card-body text-center d-flex flex-column justify-content-center align-items-center h-100 py-3">
                            <h6 class="card-title text-white mb-2"><i class="fas fa-exclamation-circle me-2"></i>Due Amount</h6>
                            <p class="card-text text-white fs-4 fw-bold mb-0">{{ number_format($totalDueAmount, 2) }}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-2">
                    <div class="card border-0 shadow-sm mb-2" style="background: linear-gradient(to bottom right, #6c757d, #343a40); height: 120px;">
                        <div class="card-body text-center d-flex flex-column justify-content-center align-items-center h-100 py-3">
                            <h6 class="card-title text-white mb-2"><i class="fas fa-list-ol me-2"></i>Total Records</h6>
                            <p class="card-text text-white fs-4 fw-bold mb-0">{{ $unifiedData->total() }}</p>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Data Table -->
            <div class="table-responsive">
                <table class="table table-sm table-bordered table-hover">
                    <thead style="background: linear-gradient(to right, #0d6efd, #0dcaf0);">
                        <tr>
                            <th style="width: 60px; color: white; font-weight: bold; border-color: #0a58ca;" wire:click="sortBy('id')" class="cursor-pointer">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span>#</span>
                                    @if ($sortField === 'id')
                                        @if ($sortDirection === 'asc')
                                            <i class="fas fa-sort-up"></i>
                                        @else
                                            <i class="fas fa-sort-down"></i>
                                        @endif
                                    @else
                                        <i class="fas fa-sort"></i>
                                    @endif
                                </div>
                            </th>
                            <th style="color: white; font-weight: bold; border-color: #0a58ca;" wire:click="sortBy('type')" class="cursor-pointer">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span>Type</span>
                                    @if ($sortField === 'type')
                                        @if ($sortDirection === 'asc')
                                            <i class="fas fa-sort-up"></i>
                                        @else
                                            <i class="fas fa-sort-down"></i>
                                        @endif
                                    @else
                                        <i class="fas fa-sort"></i>
                                    @endif
                                </div>
                            </th>
                            <th style="color: white; font-weight: bold; border-color: #0a58ca;" wire:click="sortBy('number')" class="cursor-pointer">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span>Number</span>
                                    @if ($sortField === 'number')
                                        @if ($sortDirection === 'asc')
                                            <i class="fas fa-sort-up"></i>
                                        @else
                                            <i class="fas fa-sort-down"></i>
                                        @endif
                                    @else
                                        <i class="fas fa-sort"></i>
                                    @endif
                                </div>
                            </th>
                            <th style="color: white; font-weight: bold; border-color: #0a58ca;" wire:click="sortBy('date')" class="cursor-pointer">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span>Date</span>
                                    @if ($sortField === 'date')
                                        @if ($sortDirection === 'asc')
                                            <i class="fas fa-sort-up"></i>
                                        @else
                                            <i class="fas fa-sort-down"></i>
                                        @endif
                                    @else
                                        <i class="fas fa-sort"></i>
                                    @endif
                                </div>
                            </th>
                            <th style="color: white; font-weight: bold; border-color: #0a58ca;">Name</th>
                            <th style="color: white; font-weight: bold; border-color: #0a58ca;">Doctor</th>
                            <th style="color: white; font-weight: bold; border-color: #0a58ca;">Service/Item</th>
                            <th style="color: white; font-weight: bold; border-color: #0a58ca;" wire:click="sortBy('total_amount')" class="cursor-pointer">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span>Total</span>
                                    @if ($sortField === 'total_amount')
                                        @if ($sortDirection === 'asc')
                                            <i class="fas fa-sort-up"></i>
                                        @else
                                            <i class="fas fa-sort-down"></i>
                                        @endif
                                    @else
                                        <i class="fas fa-sort"></i>
                                    @endif
                                </div>
                            </th>
                            <th style="color: white; font-weight: bold; border-color: #0a58ca;">Discount</th>
                            <th style="color: white; font-weight: bold; border-color: #0a58ca;" wire:click="sortBy('net_amount')" class="cursor-pointer">
                                <div class="d-flex justify-content-between align-items-center">
                                    <span>Net Amount</span>
                                    @if ($sortField === 'net_amount')
                                        @if ($sortDirection === 'asc')
                                            <i class="fas fa-sort-up"></i>
                                        @else
                                            <i class="fas fa-sort-down"></i>
                                        @endif
                                    @else
                                        <i class="fas fa-sort"></i>
                                    @endif
                                </div>
                            </th>
                            <th style="color: white; font-weight: bold; border-color: #0a58ca;">Paid</th>
                            <th style="color: white; font-weight: bold; border-color: #0a58ca;">Due</th>
                            <th style="color: white; font-weight: bold; border-color: #0a58ca;">Status</th>
                            <th style="color: white; font-weight: bold; border-color: #0a58ca;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($unifiedData as $item)
                            <tr>
                                <td>{{ $loop->iteration }}</td>
                                <td>{{ $item['type_name'] }}</td>
                                <td>{{ $item['number'] }}</td>
                                <td>
                                    @if(is_string($item['date']))
                                        {{ $item['date'] }}
                                    @else
                                        {{ $item['date']->format('Y-m-d') }}
                                    @endif
                                </td>
                                <td>
                                    @if(!empty($item['patient_name']))
                                        {{ $item['patient_name'] }}
                                    @elseif(!empty($item['supplier_name']))
                                        {{ $item['supplier_name'] }}
                                    @else
                                        N/A
                                    @endif
                                </td>
                                <td>{{ $item['doctor_name'] ?? 'N/A' }}</td>
                                <td>{{ $item['service_name'] ?? 'N/A' }}</td>
                                <td class="text-end">{{ number_format($item['total_amount'], 2) }}</td>
                                <td class="text-end">{{ number_format($item['discount_amount'], 2) }}</td>
                                <td class="text-end">{{ number_format($item['net_amount'], 2) }}</td>
                                <td class="text-end">{{ number_format($item['paid_amount'], 2) }}</td>
                                <td class="text-end">{{ number_format($item['due_amount'], 2) }}</td>
                                <td>
                                    @if($item['payment_status'] == 'Paid')
                                        <span class="badge bg-success">Paid</span>
                                    @elseif($item['payment_status'] == 'Partial')
                                        <span class="badge bg-warning">Partial</span>
                                    @else
                                        <span class="badge bg-danger">Due</span>
                                    @endif
                                </td>
                                <td>
                                    <button type="button" class="btn btn-sm btn-primary" 
                                        wire:click="showDetails({{ $item['id'] }}, '{{ $item['type'] }}')"
                                        title="View Details">
                                        <i class="fas fa-eye"></i>
                                    </button>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="14" class="text-center">No data found</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
            <div class="d-flex justify-content-end mt-3">
                {{ $unifiedData->links() }}
            </div>
        </div>
    </div>

    <!-- Details Modal -->
    <div class="modal fade" id="detailsModal" tabindex="-1" aria-labelledby="detailsModalLabel" aria-hidden="true" wire:ignore.self>
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="detailsModalLabel">
                        @if($selectedItem)
                            @if($viewType == 'fee')
                                Fee Receipt Details #{{ $selectedItem->id }}
                            @elseif($viewType == 'service')
                                Service Receipt Details #{{ $selectedItem->id }}
                            @elseif($viewType == 'sale')
                                Sale Invoice Details #{{ $selectedItem->invoice_no }}
                            @elseif($viewType == 'return')
                                Return Invoice Details #{{ $selectedItem->return_invoice_id }}
                            @elseif($viewType == 'purchase')
                                Purchase Details #{{ $selectedItem->purchase_no }}
                            @endif
                        @else
                            Details
                        @endif
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
                </div>
                <div class="modal-body">
                    @if($selectedItem)
                        @if($viewType == 'fee')
                            <!-- Fee Receipt Details -->
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <p><strong>Patient:</strong> {{ $selectedItem->patient->name ?? 'N/A' }}</p>
                                    <p><strong>Doctor:</strong> {{ $selectedItem->employee->first_name ?? '' }} {{ $selectedItem->employee->last_name ?? '' }}</p>
                                    <p><strong>Fee:</strong> {{ $selectedItem->fees->name ?? 'N/A' }}</p>
                                    <p><strong>Amount:</strong> {{ number_format($selectedItem->total_amount, 2) }}</p>
                                </div>
                                <div class="col-md-6">
                                    <p><strong>Date:</strong> {{ $selectedItem->created_at->format('Y-m-d') }}</p>
                                    <p><strong>Discount:</strong> {{ number_format($selectedItem->discount_amount, 2) }}</p>
                                    <p><strong>Net Amount:</strong> {{ number_format($selectedItem->total_amount - $selectedItem->discount_amount, 2) }}</p>
                                    <p><strong>Created By:</strong> {{ $selectedItem->user->name ?? 'N/A' }}</p>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-12">
                                    <p><strong>Notes:</strong> {{ $selectedItem->note ?? 'No notes available' }}</p>
                                </div>
                            </div>
                        @elseif($viewType == 'service')
                            <!-- Service Receipt Details -->
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <p><strong>Patient:</strong> {{ $selectedItem->patient->name ?? 'N/A' }}</p>
                                    <p><strong>Doctor:</strong> {{ $selectedItem->employee->first_name ?? '' }} {{ $selectedItem->employee->last_name ?? '' }}</p>
                                    <p><strong>Service:</strong> {{ $selectedItem->service->name ?? 'N/A' }}</p>
                                    <p><strong>Amount:</strong> {{ number_format($selectedItem->total_amount, 2) }}</p>
                                </div>
                                <div class="col-md-6">
                                    <p><strong>Date:</strong> {{ $selectedItem->created_at->format('Y-m-d') }}</p>
                                    <p><strong>Discount:</strong> {{ number_format($selectedItem->discount_amount, 2) }}</p>
                                    <p><strong>Net Amount:</strong> {{ number_format($selectedItem->total_amount - $selectedItem->discount_amount, 2) }}</p>
                                    <p><strong>Created By:</strong> {{ $selectedItem->user->name ?? 'N/A' }}</p>
                                </div>
                            </div>
                            <div class="row">
                                <div class="col-12">
                                    <p><strong>Notes:</strong> {{ $selectedItem->note ?? 'No notes available' }}</p>
                                </div>
                            </div>
                        @elseif($viewType == 'sale')
                            <!-- Sale Invoice Details -->
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <p><strong>Invoice No:</strong> {{ $selectedItem->invoice_no }}</p>
                                    <p><strong>Patient:</strong> {{ $selectedItem->patient->name ?? 'N/A' }}</p>
                                    <p><strong>Total Amount:</strong> {{ number_format($selectedItem->net_amount, 2) }}</p>
                                    <p><strong>Payment Status:</strong> {{ $selectedItem->payment_status }}</p>
                                </div>
                                <div class="col-md-6">
                                    <p><strong>Date:</strong> {{ $selectedItem->invoice_date }}</p>
                                    <p><strong>Paid Amount:</strong> {{ number_format($selectedItem->paid_amount, 2) }}</p>
                                    <p><strong>Due Amount:</strong> {{ number_format($selectedItem->due_amount, 2) }}</p>
                                    <p><strong>Created By:</strong> {{ $selectedItem->user->name ?? 'N/A' }}</p>
                                </div>
                            </div>
                            <h6 class="fw-bold">Products</h6>
                            <div class="table-responsive">
                                <table class="table table-sm table-bordered">
                                    <thead class="table-light">
                                        <tr>
                                            <th>#</th>
                                            <th>Product</th>
                                            <th>Qty</th>
                                            <th>Price</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @foreach($selectedItem->saleInvoiceDetails as $index => $detail)
                                            <tr>
                                                <td>{{ $index + 1 }}</td>
                                                <td>{{ $detail->product->name ?? 'N/A' }}</td>
                                                <td>{{ $detail->quantity }}</td>
                                                <td>{{ number_format($detail->price, 2) }}</td>
                                                <td>{{ number_format($detail->quantity * $detail->price, 2) }}</td>
                                            </tr>
                                        @endforeach
                                    </tbody>
                                </table>
                            </div>
                        @elseif($viewType == 'return')
                            <!-- Return Invoice Details -->
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <p><strong>Return Invoice ID:</strong> {{ $selectedItem->return_invoice_id }}</p>
                                    <p><strong>Patient:</strong> {{ $selectedItem->patient->name ?? 'N/A' }}</p>
                                    <p><strong>Total Amount:</strong> {{ number_format($selectedItem->net_amount, 2) }}</p>
                                    <p><strong>Payment Status:</strong> {{ $selectedItem->payment_status }}</p>
                                </div>
                                <div class="col-md-6">
                                    <p><strong>Date:</strong> {{ $selectedItem->return_invoice_date }}</p>
                                    <p><strong>Paid Amount:</strong> {{ number_format($selectedItem->paid_amount, 2) }}</p>
                                    <p><strong>Due Amount:</strong> {{ number_format($selectedItem->due_amount, 2) }}</p>
                                    <p><strong>Created By:</strong> {{ $selectedItem->user->name ?? 'N/A' }}</p>
                                </div>
                            </div>
                            <h6 class="fw-bold">Returned Products</h6>
                            <div class="table-responsive">
                                <table class="table table-sm table-bordered">
                                    <thead class="table-light">
                                        <tr>
                                            <th>#</th>
                                            <th>Product</th>
                                            <th>Qty</th>
                                            <th>Price</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @foreach($selectedItem->returnInvoiceDetails as $index => $detail)
                                            <tr>
                                                <td>{{ $index + 1 }}</td>
                                                <td>{{ $detail->product->name ?? 'N/A' }}</td>
                                                <td>{{ $detail->quantity }}</td>
                                                <td>{{ number_format($detail->price, 2) }}</td>
                                                <td>{{ number_format($detail->quantity * $detail->price, 2) }}</td>
                                            </tr>
                                        @endforeach
                                    </tbody>
                                </table>
                            </div>
                        @elseif($viewType == 'purchase')
                            <!-- Purchase Details -->
                            <div class="row mb-3">
                                <div class="col-md-6">
                                    <p><strong>Purchase No:</strong> {{ $selectedItem->purchase_no }}</p>
                                    <p><strong>Invoice No:</strong> {{ $selectedItem->invoice_no }}</p>
                                    <p><strong>Supplier:</strong> {{ $selectedItem->supplier->name ?? 'N/A' }}</p>
                                    <p><strong>Total Amount:</strong> {{ number_format($selectedItem->net_amount, 2) }}</p>
                                </div>
                                <div class="col-md-6">
                                    <p><strong>Date:</strong> {{ $selectedItem->purchase_date }}</p>
                                    <p><strong>Paid Amount:</strong> {{ number_format($selectedItem->paid_amount, 2) }}</p>
                                    <p><strong>Due Amount:</strong> {{ number_format($selectedItem->due_amount, 2) }}</p>
                                    <p><strong>Created By:</strong> {{ $selectedItem->user->name ?? 'N/A' }}</p>
                                </div>
                            </div>
                            <h6 class="fw-bold">Purchased Products</h6>
                            <div class="table-responsive">
                                <table class="table table-sm table-bordered">
                                    <thead class="table-light">
                                        <tr>
                                            <th>#</th>
                                            <th>Product</th>
                                            <th>Qty</th>
                                            <th>Price</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        @foreach($selectedItem->purchaseDetails as $index => $detail)
                                            <tr>
                                                <td>{{ $index + 1 }}</td>
                                                <td>{{ $detail->product->name ?? 'N/A' }}</td>
                                                <td>{{ $detail->quantity }}</td>
                                                <td>{{ number_format($detail->price, 2) }}</td>
                                                <td>{{ number_format($detail->quantity * $detail->price, 2) }}</td>
                                            </tr>
                                        @endforeach
                                    </tbody>
                                </table>
                            </div>
                        @endif
                    @else
                        <p class="text-center">Loading details...</p>
                    @endif
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" wire:click="closeDetailsModal">Close</button>
                </div>
            </div>
        </div>
    </div>
</div>
