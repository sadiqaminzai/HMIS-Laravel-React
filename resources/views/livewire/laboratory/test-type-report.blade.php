<!-- filepath: c:\xampp\htdocs\HMIS\resources\views\livewire\laboratory\test-type-report.blade.php -->
<div>
    <div class="container">
        <!-- Page Title -->
        <div class="row mb-3">
            <div class="col-md-12 text-center">
                <h3 class="fw-bold text-white">Laboratory Test Type Report</h3>
            </div>
        </div>
        
        <!-- Collapsible Search Options -->
        <div class="card mb-4 shadow-sm">
            <div class="card-header  py-2" role="button" data-bs-toggle="collapse" data-bs-target="#searchOptionsCollapse" aria-expanded="false" aria-controls="searchOptionsCollapse">
                <div class="d-flex justify-content-between align-items-center">
                    <h5 class="mb-0"><i class="fas fa-search me-2"></i>Search Options</h5>
                    <i class="fas fa-chevron-down"></i>
                </div>
            </div>
            <div class="collapse" id="searchOptionsCollapse">
                <div class="card-body">
                    <div class="row g-3">
                        <!-- First Row -->
                        <div class="col-md-4">
                            <div class="form-group">
                                <label for="search_id" class="form-label fw-bold">Test ID</label>
                                <input type="text" wire:model="search_id" id="search_id" class="form-control" placeholder="Search by ID">
                            </div>
                        </div>
                        
                        <div class="col-md-4">
                            <div class="form-group">
                                <label for="search_name" class="form-label fw-bold">Test Name</label>
                                <input type="text" wire:model="search_name" id="search_name" class="form-control" placeholder="Search by name">
                            </div>
                        </div>
                        
                        <div class="col-md-4">
                            <div class="form-group">
                                <label for="search_service_type_id" class="form-label fw-bold">Service Type</label>
                                <select wire:model="search_service_type_id" id="search_service_type_id" class="form-select">
                                    <option value="" selected>Select Service Type</option>
                                    @foreach($serviceTypes as $type)
                                        <option value="{{ $type->id }}">{{ $type->name }}</option>
                                    @endforeach
                                </select>
                            </div>
                        </div>
                        
                        <!-- Second Row -->
                        <div class="col-md-4">
                            <div class="form-group">
                                <label class="form-label fw-bold">Date Range</label>
                                <div class="input-group">
                                    <input type="date" wire:model="searchFromDate" class="form-control" placeholder="From Date">
                                    <input type="date" wire:model="searchToDate" class="form-control" placeholder="To Date">
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Search Buttons -->
                    <div class="row mt-4">
                        <div class="col-md-12 text-center">
                            <button wire:click="searchDetails" class="btn btn-primary px-4 me-2" data-bs-toggle="modal" data-bs-target="#searchModal">
                                <i class="btn-icon-prepend" data-feather="search"></i> Search
                            </button>
                            <button wire:click="clearSearch" class="btn btn-danger px-4">
                                <i class="btn-icon-prepend" data-feather="x-circle"></i> Clear
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Table displaying Test Type details -->
        <div class="table-responsive">
            <table class="table table-bordered">
                <thead>
                    <tr>
                        <th>S.No</th>
                        <th>ID</th>
                        <th>Test Name</th>
                        <th>Service Type</th>
                        <th>Created At</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    @foreach($services as $key => $service)
                    <tr>
                        <td>{{ $key + 1 }}</td>
                        <td>{{ $service->id }}</td>
                        <td>{{ $service->name }}</td>
                        <td>{{ $service->service_type ? $service->service_type->name : 'N/A' }}</td>
                        <td>{{ $service->created_at ? $service->created_at->format('Y-m-d') : '' }}</td>
                        <td>
                            <button wire:click="showDetails({{ $service->id }})" class="btn btn-icon-text btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#detailsModal">
                                <i class="btn-icon-prepend" data-feather="info"></i>Details
                            </button>
                        </td>
                    </tr>
                    @endforeach
                </tbody>
            </table>
        </div>

        <!-- Pagination Links -->
        {{ $services->links() }}
    </div>

    <!-- Details Modal -->
    <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog" aria-labelledby="detailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <!-- Header -->
                <div class="modal-header text-white">
                    <h5 class="modal-title" id="detailsModalLabel">Test Type Details</h5>
                    <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
                </div>

                <!-- Body -->
                <div class="modal-body p-2">
                    @if($selectedService)
                        <div class="row g-3">
                            <div class="col-md-4">
                                <div class="p-3 rounded border">
                                    <strong>ID:</strong> {{ $selectedService->id }}
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="p-3 rounded border">
                                    <strong>Test Name:</strong> {{ $selectedService->name }}
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="p-3 rounded border">
                                    <strong>Service Type:</strong> {{ $selectedService->service_type ? $selectedService->service_type->name : 'N/A' }}
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="p-3 rounded border">
                                    <strong>Created At:</strong> {{ $selectedService->created_at ? $selectedService->created_at->format('Y-m-d') : '' }}
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="p-3 rounded border">
                                    <strong>Updated At:</strong> {{ $selectedService->updated_at ? $selectedService->updated_at->format('Y-m-d') : '' }}
                                </div>
                            </div>
                            <div class="col-md-4">
                                <div class="p-3 rounded border">
                                    <strong>Status:</strong> {{ $selectedService->is_active ? 'Active' : 'Inactive' }}
                                </div>
                            </div>
                        </div>
                    @endif
                </div>
            </div>
        </div>
    </div>

    <!-- Search Modal -->
    <div wire:ignore.self class="modal fade" id="searchModal" tabindex="-1" role="dialog" aria-labelledby="searchModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl" role="document">
            <div class="modal-content">
                <!-- Header -->
                <div class="modal-header text-white">
                    <h5 class="modal-title" id="searchModalLabel">Test Type Search Results</h5>
                    <div class="col-md-3 text-end">
                        <div class="btn-group" role="group">
                            <button class="btn btn-outline-success btn-icon-text btn-sm" wire:click="excel">Excel</button>
                            <button class="btn btn-outline-danger btn-icon-text btn-sm" wire:click="pdf">PDF</button>
                            <button class="btn btn-outline-secondary btn-icon-text btn-sm" onclick="window.open('{{ url('/laboratory/test-type-report-print') }}', '_blank')">Print</button>
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
                                    <th>ID</th>
                                    <th>Test Name</th>
                                    <th>Service Type</th>
                                    <th>Created At</th>
                                    <th>Updated At</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse($searchResults as $key => $service)
                                <tr>
                                    <td>{{ $key + 1 }}</td>
                                    <td>{{ $service->id }}</td>
                                    <td>{{ $service->name }}</td>
                                    <td>{{ $service->service_type ? $service->service_type->name : 'N/A' }}</td>
                                    <td>{{ $service->created_at ? $service->created_at->format('Y-m-d') : '' }}</td>
                                    <td>{{ $service->updated_at ? $service->updated_at->format('Y-m-d') : '' }}</td>
                                    <td>{{ $service->is_active ? 'Active' : 'Inactive' }}</td>
                                </tr>
                                @empty
                                <tr>
                                    <td colspan="7" class="text-center">No records found.</td>
                                </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
                
                <!-- Footer -->
                <div class="modal-footer">
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
        });
    </script>
</div>