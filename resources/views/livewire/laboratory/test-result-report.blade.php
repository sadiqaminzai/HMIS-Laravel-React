<div>
    <div class="container">
        <div class="row mb-1">
            <div class="col-md-12 text-start">
                <h3>Test Result Report</h3>
            </div>
        </div>
        <div class="row mb-1">
            <div class="col-md-12 text-start">
                Search by:
            </div>
        </div>
        <div class="row mb-3">
            <div class="col-md-2">
                <input type="text" wire:model="search" class="form-control" placeholder="Search by ID/Name">
            </div>
            <div class="col-md-2">
                <input type="text" wire:model="search_patient_name" class="form-control" placeholder="Patient Name">
            </div>
            <div class="col-md-2">
                <select wire:model="search_reporting_date" class="form-select">
                    <option value="">Select Reporting Date</option>
                    @foreach($results->unique('reporting_date') as $result)
                    <option value="{{ $result->reporting_date }}">{{ $result->reporting_date }}</option>
                    @endforeach
                </select>
            </div>
            <div class="col-md-4">
                <div class="input-group">
                    <input type="date" wire:model="searchFromDate" class="form-control" placeholder="From Date">
                    <input type="date" wire:model="searchToDate" class="form-control" placeholder="To Date">
                </div>
            </div>
            <div class="col-md-2 py-1">
                <button wire:click="searchDetails" class="btn btn-outline-info btn-sm" data-bs-toggle="modal" data-bs-target="#searchModal">
                    <i class="btn-icon-prepend" data-feather="search" style="width: 16px; height: 16px;"></i> Search
                </button>
                <button wire:click="clearSearch" class="btn btn-outline-danger btn-icon-text btn-sm">
                    <i class="btn-icon-prepend" data-feather="x-circle"></i> Clear
                </button>
            </div>
        </div>

        <!-- Table displaying Service Receipts with lab tests -->
        <div class="table-responsive">
            <table class="table table-bordered">
                <thead>
                    <tr>
                        <th>Receipt ID</th>
                        <th>Patient Code</th>
                        <th>Patient Name</th>
                        <th>Doctor Name</th>
                        <th>Receipt Date</th>
                        <th>Receipt Status</th>
                        @if(Auth::user()->can('lab.test.result.details'))
                            <th>Action</th>
                        @endif
                    </tr>
                </thead>
                <tbody>
                    @foreach($service_receipts as $service_receipt)
                    <tr>
                        <td>{{ $service_receipt->id ?? '' }}</td>
                        <td>{{ $service_receipt->patient->id  ?? '' }}</td>
                        <td>{{ $service_receipt->patient->name  ?? '' }}</td>
                        <td>
                            {{ $service_receipt->employee->first_name ?? '' }}
                            {{ $service_receipt->employee->last_name  ?? '' }}
                        </td>
                        <td>{{ $service_receipt->receipt_date  ?? '' }}</td>
                        <td>
                            {!! $service_receipt->lab_test_status == 0
                                ? '<span class="badge bg-warning">Pending</span>'
                                : '<span class="badge bg-success">Completed</span>'
                            !!}
                        </td>
                        @if(Auth::user()->can('lab.test.result.details'))
                        <td>
                            <button wire:click="showDetails({{ $service_receipt->id }})"
                                    class="btn btn-outline-info btn-icon-text btn-sm"
                                    data-bs-toggle="modal" data-bs-target="#detailsModal">
                                <i class="btn-icon-prepend" data-feather="info"></i>Details
                            </button>
                        </td>
                        @endif
                    </tr>
                    @endforeach
                </tbody>
            </table>
        </div>

        <!-- Pagination Links -->
        @if(!$search && !$search_patient_name && !$search_reporting_date && !($searchFromDate && $searchToDate))
        <div class="d-flex justify-content-end">
            {{ $service_receipts->links() }}
        </div>
        @endif

        <!-- Details Modal for lab service receipt -->
        <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog" aria-labelledby="detailsModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl" role="document">
                <div class="modal-content">
                    <!-- Header -->
                    <div class="modal-header text-white">
                        <h5 class="modal-title" id="detailsModalLabel">Service Receipt Details</h5>
                        <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
                    </div>

                    <!-- Body -->
                    <div class="modal-body p-2">
                        @if($selectedResult)
                            <!-- Patient Info Section -->
                            <div class="row mb-2">
                                <div class="col-md-2">
                                    <span class="text-primary small">Patient Name:</span><br>
                                    <span class="text-white">{{ $selectedResult->patient->name ?? 'N/A' }}</span>
                                </div>
                                <div class="col-md-2">
                                    <span class="text-primary small">Doctor Name:</span><br>
                                    <span class="text-white">
                                        {{ $selectedResult->employee->first_name ?? 'N/A' }}
                                        {{ $selectedResult->employee->last_name ?? 'N/A' }}
                                    </span>
                                </div>
                                <div class="col-md-2">
                                    <span class="text-primary small">Created By:</span><br>
                                    <span class="text-white">{{ $selectedResult->user->name ?? 'N/A' }}</span>
                                </div>
                                <div class="col-md-2">
                                    <span class="text-primary small">Payment Method:</span><br>
                                    <span class="text-white">
                                        {{ ucfirst($selectedResult->payment_method ?? 'N/A') }}
                                    </span>
                                </div>
                                <div class="col-md-1">
                                    <span class="text-primary small">Payment:</span><br>
                                    <span class="badge {{ $selectedResult->payment_status == 'paid' ? 'bg-success' : 'bg-danger' }}">
                                        {{ ucfirst($selectedResult->payment_status ?? 'N/A') }}
                                    </span>
                                </div>
                                <div class="col-md-1">
                                    <span class="text-primary small">Status:</span><br>
                                    <span class="badge {{ $selectedResult->is_active == 1 ? 'bg-success' : 'bg-secondary' }}">
                                        {{ $selectedResult->is_active == 1 ? 'Active' : 'Inactive' }}
                                    </span>
                                </div>
                                <div class="col-md-2">
                                    <span class="text-primary small">Receipt Date:</span><br>
                                    <span class="text-white">
                                        {{ $selectedResult->receipt_date ?? 'N/A' }}
                                    </span>
                                </div>
                            </div>

                            <!-- Service Details Table -->
                            @if($selectedResult->service_receipt_details)
                                <div class="row">
                                    <div class="col-md-12">
                                        <h6>Lab Services</h6>
                                        <div class="table-responsive" style="max-height: 150px; overflow-y: auto;">
                                            <table class="table table-bordered table-hover">
                                                <thead style="position: sticky; top: 0; z-index: 1;">
                                                    <tr>
                                                        <th>S.N</th>
                                                        <th>Service Name</th>
                                                        <th>Service Type</th>
                                                        <th>Price</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    @foreach($selectedResult->service_receipt_details as $service_receipt_detail)
                                                    <tr>
                                                        <td>{{ $loop->iteration }}</td>
                                                        <td>{{ $service_receipt_detail->service->name ?? 'N/A' }}</td>
                                                        <td>{{ $service_receipt_detail->service_type->name ?? 'N/A' }}</td>
                                                        <td>{{ $service_receipt_detail->price ?? 'N/A' }}</td>
                                                    </tr>
                                                    @endforeach
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            @endif

                            <!-- Payment Information Section -->
                            <div class="row mt-2">
                                <div class="col-md-2">
                                    <span class="text-primary small">Total Amount:</span><br>
                                    <span class="text-success">
                                        {{ number_format($selectedResult->total_amount ?? 0, 2) }}
                                    </span>
                                </div>
                                <div class="col-md-2">
                                    <span class="text-primary small">Discount:</span><br>
                                    <span class="text-success">{{ $selectedResult->discount ?? 0 }}%</span>
                                </div>
                                <div class="col-md-2">
                                    <span class="text-primary small">Discount Amount:</span><br>
                                    <span class="text-success">
                                        {{ number_format($selectedResult->discount_amount ?? 0, 2) }}
                                    </span>
                                </div>
                                <div class="col-md-2">
                                    <span class="text-primary small">Net Amount:</span><br>
                                    <span class="text-success">
                                        {{ number_format($selectedResult->net_amount ?? 0, 2) }}
                                    </span>
                                </div>
                                <div class="col-md-2">
                                    <span class="text-primary small">Paid Amount:</span><br>
                                    <span class="text-success">
                                        {{ number_format($selectedResult->paid_amount ?? 0, 2) }}
                                    </span>
                                </div>
                                <div class="col-md-2">
                                    <span class="text-primary small">Due Amount:</span><br>
                                    <span class="text-danger">
                                        {{ number_format($selectedResult->due_amount ?? 0, 2) }}
                                    </span>
                                </div>
                            </div>
                        @endif
                    </div>

                    <!-- Modal Footer -->
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" wire:click="closeDetailsModal">Close</button>
                        
                        <!-- Export options -->
                        <div class="btn-group" role="group">
                           
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Results Modal for test results -->
        <div wire:ignore.self class="modal fade" id="resultsModal" tabindex="-1" role="dialog" aria-labelledby="resultsModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl" role="document">
                <div class="modal-content">
                    <!-- Header -->
                    <div class="modal-header text-white">
                        <h5 class="modal-title" id="resultsModalLabel">Test Result Details</h5>
                        <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>

                    <!-- Body -->
                    <div class="modal-body p-2">
                        @if($selectedResult)
                            <!-- Patient Info Section -->
                            <div class="row mb-2">
                                <div class="col-md-2">
                                    <span class="text-primary small">Patient Name:</span><br>
                                    <span class="text-white">{{ $selectedResult->patient->name ?? 'N/A' }}</span>
                                </div>
                                <div class="col-md-2">
                                    <span class="text-primary small">Doctor Name:</span><br>
                                    <span class="text-white">
                                        {{ $selectedResult->employee->first_name ?? 'N/A' }}
                                        {{ $selectedResult->employee->last_name ?? 'N/A' }}
                                    </span>
                                </div>
                                <div class="col-md-2">
                                    <span class="text-primary small">Receipt Date:</span><br>
                                    <span class="text-white">
                                        {{ $selectedResult->receipt_date ?? 'N/A' }}
                                    </span>
                                </div>
                                <div class="col-md-2">
                                    <span class="text-primary small">Reporting Date:</span><br>
                                    <span class="text-white">
                                        {{ $reporting_date ?? 'N/A' }}
                                    </span>
                                </div>
                                <div class="col-md-2">
                                    <span class="text-primary small">Lab Technician:</span><br>
                                    <span class="text-white">
                                        {{ Auth::user()->name }}
                                    </span>
                                </div>
                                <div class="col-md-2">
                                    <span class="text-primary small">Status:</span><br>
                                    <span class="badge {{ $selectedResult->lab_test_status == 1 ? 'bg-success' : 'bg-warning' }}">
                                        {{ $selectedResult->lab_test_status == 1 ? 'Completed' : 'Pending' }}
                                    </span>
                                </div>
                            </div>

                            <!-- Load test results table here -->
                            <!-- This will be populated once results are loaded -->
                            
                            <!-- Remarks section -->
                            <div class="row mt-3">
                                <div class="col-md-12">
                                    <div class="p-3 rounded border">
                                        <strong>Remarks:</strong> {{ $remarks ?? 'N/A' }}
                                    </div>
                                </div>
                            </div>
                        @endif
                    </div>

                    <!-- Modal Footer -->
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        
                        <!-- Export options -->
                        <div class="btn-group" role="group">
                            <button class="btn btn-outline-success btn-icon-text btn-sm" wire:click="exportSingleExcel({{ $selectedResult ? $selectedResult->id : 0 }})">
                                <i class="btn-icon-prepend" data-feather="file-text"></i> Excel
                            </button>
                            <button class="btn btn-outline-danger btn-icon-text btn-sm" wire:click="exportSinglePdf({{ $selectedResult ? $selectedResult->id : 0 }})">
                                <i class="btn-icon-prepend" data-feather="file"></i> PDF
                            </button>
                            <button class="btn btn-outline-secondary btn-icon-text btn-sm" wire:click="printSingleResult({{ $selectedResult ? $selectedResult->id : 0 }})">
                                <i class="btn-icon-prepend" data-feather="printer"></i> Print
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Search Modal with export options -->
        <div wire:ignore.self class="modal fade" id="searchModal" tabindex="-1" role="dialog" aria-labelledby="searchModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-xl" role="document">
                <div class="modal-content">
                    <!-- Header -->
                    <div class="modal-header text-white d-flex justify-content-between align-items-center">
                        <h5 class="modal-title" id="searchModalLabel">Test Result Report</h5>
                        <div class="btn-group" role="group">
                            <button class="btn btn-outline-success btn-icon-text btn-sm" wire:click="excel">
                                <i class="btn-icon-prepend" data-feather="file-text"></i> Excel
                            </button>
                            <button class="btn btn-outline-danger btn-icon-text btn-sm" wire:click="pdf">
                                <i class="btn-icon-prepend" data-feather="file"></i> PDF
                            </button>
                            <button class="btn btn-outline-secondary btn-icon-text btn-sm" onclick="window.open('{{ url('/laboratory/test-result-report-print') }}', '_blank')">
                                <i class="btn-icon-prepend" data-feather="printer"></i> Print
                            </button>
                        </div>
                        <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeSearchModal"></button>
                    </div>
                    
                    <!-- Body -->
                    <div class="modal-body p-2" style="max-height: 500px; overflow-y: auto;">
                        <div class="table-responsive">
                            <table class="table table-bordered">
                                <thead>
                                    <tr>
                                        <th>Receipt ID</th>
                                        <th>Patient Code</th>
                                        <th>Patient Name</th>
                                        <th>Doctor Name</th>
                                        <th>Tests</th>
                                        <th>Receipt Date</th>
                                        <th>Status</th>
                                        <th>Financials</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    @forelse($searchResults as $result)
                                    <tr>
                                        <td>{{ $result->id ?? '' }}</td>
                                        <td>{{ $result->patient->id ?? '' }}</td>
                                        <td>{{ $result->patient->name ?? '' }}</td>
                                        <td>
                                            {{ $result->employee->first_name ?? '' }}
                                            {{ $result->employee->last_name ?? '' }}
                                        </td>
                                        <td>
                                            @php $testNames = []; @endphp
                                            @foreach($result->service_receipt_details as $detail)
                                                @php $testNames[] = $detail->service->name ?? 'N/A'; @endphp
                                            @endforeach
                                            {{ implode(', ', $testNames) }}
                                        </td>
                                        <td>{{ $result->receipt_date ?? '' }}</td>
                                        <td>
                                            {!! $result->lab_test_status == 0
                                                ? '<span class="badge bg-warning">Pending</span>'
                                                : '<span class="badge bg-success">Completed</span>'
                                            !!}
                                            <br>
                                            <span class="badge {{ $result->payment_status == 'paid' ? 'bg-success' : 'bg-danger' }}">
                                                {{ ucfirst($result->payment_status ?? 'N/A') }}
                                            </span>
                                        </td>
                                        <td>
                                            <small>
                                                <strong>Total:</strong> {{ number_format($result->total_amount ?? 0, 2) }}<br>
                                                <strong>Discount:</strong> {{ $result->discount ?? 0 }}%<br>
                                                <strong>Net:</strong> {{ number_format($result->net_amount ?? 0, 2) }}<br>
                                                <strong>Paid:</strong> {{ number_format($result->paid_amount ?? 0, 2) }}
                                            </small>
                                        </td>
                                        <td>
                                            <div class="btn-group" role="group">
                                                <button wire:click="showDetails({{ $result->id }})" 
                                                        class="btn btn-outline-info btn-icon-text btn-sm"
                                                        data-bs-toggle="modal" data-bs-target="#detailsModal">
                                                    <i class="btn-icon-prepend" data-feather="info"></i> Details
                                                </button>
                                                
                                                <button class="btn btn-outline-success btn-icon-text btn-sm" 
                                                        wire:click="exportSingleExcel({{ $result->id }})">
                                                    <i class="btn-icon-prepend" data-feather="file-text"></i> Excel
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    @empty
                                    <tr>
                                        <td colspan="9" class="text-center">No records found matching your search criteria.</td>
                                    </tr>
                                    @endforelse
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <!-- Footer -->
                    <div class="modal-footer d-flex justify-content-between">
                        <div>
                            <strong>Total Records:</strong> <span>{{ $totalResults }}</span>
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
                
                window.addEventListener('open-print-window', (event) => {
                    window.open(event.detail.url, '_blank');
                });
            });
        </script>
    </div>
</div>