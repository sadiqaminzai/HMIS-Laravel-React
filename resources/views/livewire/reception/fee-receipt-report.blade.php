<div class="container">
    <!-- Page title and Search dropdowns -->
    <div class="row mb-2">
        <div class="col-md-12 text-start">
            <h3>Fee Receipt Report</h3>
        </div>
    </div>
    <div class="row mb-2">
        <div class="col-md-2">
            <label class="form-label"><small>Dynamic Search</small></label>
            <input type="text" wire:model.live="search" class="form-control" placeholder="Type here...">
        </div>

        <div class="col-md-1">
            <label class="form-label"><small>Search by ID</small></label>
            <select wire:model="searchById" class="form-control">
                <option value="" disabled>Select ID</option>
                @foreach($fee_receipts as $fees_receipt)
                <option value="{{ $fees_receipt->id }}">{{ $fees_receipt->id }}</option>
                @endforeach
            </select>
        </div>
        
        <!-- ID Range Search with Selects -->
        <div class="col-md-2">
            <label class="form-label"><small>ID Range</small></label>
            <div class="input-group">
                <select wire:model="searchFromId" class="form-control">
                    <option value="">From ID</option>
                    @foreach($fee_receipts as $fees_receipt)
                    <option value="{{ $fees_receipt->id }}">{{ $fees_receipt->id }}</option>
                    @endforeach
                </select>
                <select wire:model="searchToId" class="form-control">
                    <option value="">To ID</option>
                    @foreach($fee_receipts as $fees_receipt)
                    <option value="{{ $fees_receipt->id }}">{{ $fees_receipt->id }}</option>
                    @endforeach
                </select>
            </div>
        </div>
        
        <!-- Search by Patient -->
        <div class="col-md-2">
            <label class="form-label"><small>Search by Patient</small></label>
            <select wire:model="searchByPatient" class="form-control">
                <option value="" disabled>Select Patient</option>
                @foreach($fee_receipts as $fee_receipt)
                <option value="{{ $fee_receipt->patient->name }}">{{ $fee_receipt->patient->name }}</option>
                @endforeach
            </select>
        </div>
        <!-- Search by Doctor -->
        <div class="col-md-2">
            <label class="form-label"><small>Search by Doctor</small></label>
            <select wire:model="searchByDoctor" class="form-control">
                <option value="" disabled>Select Doctor</option>
                @foreach($fee_receipts as $fee_receipt)
                @if($fee_receipt->employee)
                <option value="{{ $fee_receipt->employee->first_name }} {{ $fee_receipt->employee->last_name }}">
                    {{ $fee_receipt->employee->first_name }} {{ $fee_receipt->employee->last_name }}
                </option>
                @endif
                @endforeach
            </select>
        </div>
        <div class="col-md-3">
            <label class="form-label"><small>Search by Date Range</small></label>
            <div class="input-group">
                <input type="date" wire:model="searchFromDate" class="form-control" placeholder="From Date">
                <input type="date" wire:model="searchToDate" class="form-control" placeholder="To Date">
            </div>
        </div>
        <div class="col-md-2 text-end" style="margin-top: 32px;">
            <div class="btn-group" role="group">
                <button wire:click="searchDetails" class="btn btn-outline-info btn-sm" data-bs-toggle="modal" data-bs-target="#searchModal">
                    <i class="btn-icon-prepend" data-feather="info" style="width: 16px; height: 16px;"></i> Search
                </button>
                <button class="btn btn-outline-secondary btn-icon-text btn-sm" wire:click="resetFilters">
                    <i class="btn-icon-prepend" data-feather="refresh-cw"></i>Reset
                </button>
            </div>
        </div>
    </div>

    <!-- Table displaying Fees Receipt details -->
    <div class="table-responsive">
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Total Fees</th>
                    <th>Discount</th>
                    <th>Receipt Date</th>
                    @if(Auth::user()->can('fee.receipt.edit') || Auth::user()->can('fee.receipt.delete') || Auth::user()->can('fee.receipt.details'))

                    <th>Action</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($fee_receipts as $fee_receipt)
                <tr>
                    <td>{{ $fee_receipt->id }}</td>
                    <td>{{ $fee_receipt->patient->name }}</td>
                    <td>{{ $fee_receipt->employee->first_name }} {{ $fee_receipt->employee->last_name }}</td>
                    <td>{{ $fee_receipt->total_amount }}</td>
                    <td>{{$fee_receipt->discount_amount }}</td>
                    <td>{{ $fee_receipt->receipt_date }}</td>
                    @if(Auth::user()->can('fee.receipt.details'))
                    <td>
                        @if(Auth::user()->can('fee.receipt.details'))
                        <button wire:click="showDetails({{ $fee_receipt->id }})" class="btn btn-icon-text btn-sm btn-outline-success" data-bs-toggle="modal" data-bs-target="#detailsModal">
                            <i class="btn-icon-prepend" data-feather="success"></i>Details
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
    @if(!$search) {{ $fee_receipts->links() }} @endif

    <!-- Fees Receipt Details  -->
    <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog" aria-labelledby="detailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <!-- Header -->
                <div class="modal-header  text-white">
                    <h5 class="modal-title" id="detailsModalLabel">Fee Receipt Details</h5>
                    <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
                </div>

                <!-- Body -->
                <div class="modal-body p-4">
                    <div class="row g-4">
                        <!-- Patient Information -->
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Patient Name:</strong> <span class="text-primary">{{ $selected_data?->patient->name }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Doctor Name:</strong> <span class="text-primary">{{ $selected_data?->employee->first_name }} {{ $selected_data?->employee->last_name }}</span>
                            </div>
                        </div>

                        <!-- Financial Information -->
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Discount Amount:</strong> <span class="text-success">{{ number_format($selected_data?->discount_amount, 2) }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Total Amount:</strong> <span class="text-success">{{ number_format($selected_data?->total_amount, 2) }}</span>
                            </div>
                        </div>

                        <!-- Payment Information -->
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Payment Status:</strong>
                                <span class="badge {{ $selected_data?->payment_status == 'paid' ? 'bg-success' : 'bg-danger' }}">
                                    {{ ucfirst($selected_data?->payment_status) }}
                                </span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Payment Method:</strong> <span class="text-primary">{{ ucfirst($selected_data?->payment_method) }}</span>
                            </div>
                        </div>

                        <!-- Other Information -->
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Receipt Date:</strong> <span class="text-muted">{{ $selected_data?->receipt_date }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Created By:</strong> <span class="text-muted">{{ $selected_data?->user?->name }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Status:</strong>
                                <span class="badge {{ $selected_data?->is_active == 1 ? 'bg-success' : 'bg-secondary' }}">
                                    {{ $selected_data?->is_active == 1 ? 'Active' : 'Inactive' }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="modal-footer d-flex justify-content-end">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Search Fees Receipt Modal -->
    <div wire:ignore.self class="modal fade" id="searchModal" tabindex="-1" role="dialog" aria-labelledby="searchModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl" role="document">
            <div class="modal-content">
                <!-- Header -->
                <div class="modal-header text-white">
                    <h5 class="modal-title" id="searchModalLabel">Fees Receipt Details</h5>
                    @if(Auth::user()->can('patient.add'))
                    <div class="col-md-3 text-end">
                        <div class="btn-group" role="group">
                            <button class="btn btn-outline-success btn-icon-text btn-sm" wire:click="excel">Excel</button>
                            <button class="btn btn-outline-danger btn-icon-text btn-sm" wire:click="pdf">PDF</button>
                            <button class="btn btn-outline-secondary btn-icon-text btn-sm" onclick="window.open('{{ url('/reception/f-report-print') }}', '_blank')">Print</button>
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
                                    <th>ID</th>
                                    <th>Patient</th>
                                    <th>Doctor</th>
                                    <th>Total Fees</th>
                                    <th>Discount</th>
                                    <th>Net Amount</th>
                                    <th>Receipt Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse($searchResults as $index => $fee_receipt)
                                <tr>
                                    <td>{{ $index + 1 }}</td>
                                    <td>{{ $fee_receipt->id }}</td>
                                    <td>{{ $fee_receipt->patient->name }}</td>
                                    <td>{{ $fee_receipt->employee->first_name }} {{ $fee_receipt->employee->last_name }}</td>
                                    <td>{{ $fee_receipt->total_amount }}</td>
                                    <td>{{ $fee_receipt->discount_amount }}</td>
                                    <td>{{ $fee_receipt->total_amount - $fee_receipt->discount_amount }}</td>
                                    <td>{{ $fee_receipt->receipt_date }}</td>
                                </tr>
                                @empty
                                <tr>
                                    <td colspan="8" class="text-center">No Fee Receipt records found.</td>
                                </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
                <!-- Footer -->
                <div class="modal-footer d-flex justify-content-between" style="margin-left: 10%; margin-right: 10%;">
                    <div>
                        <strong>Total Fees:</strong> <span>{{ number_format($totalFees, 2) }}</span>
                    </div>
                    <div>
                        <strong>Total Discount:</strong> <span>{{ number_format($totalDiscount, 2) }}</span>
                    </div>
                    <div>
                        <strong>Net Amount:</strong> <span>{{ number_format($totalFees - $totalDiscount, 2) }}</span>
                    </div>
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
        feather.replace();
    });
</script>