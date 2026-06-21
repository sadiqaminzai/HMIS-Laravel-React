<div class="container">
    <!-- Page title and Search dropdowns -->
    <div class="row mb-2">
        <div class="col-md-12 text-start">
            <h3>Patients Report</h3>
        </div>
    </div>
    <div class="row mb-2">
        <div class="col-md-2">
            <label class="form-label"><small>Dynamic Search</small></label>
            <input type="text" wire:model.live="search" class="form-control" placeholder="Type here...">
        </div>

        <div class="col-md-2">
            <label class="form-label"><small>Search by ID</small></label>
            <select wire:model="searchById" class="form-control">
                <option value="" disabled>Select ID</option>
                @foreach($patients as $patient)
                <option value="{{ $patient->id }}">{{ $patient->id }}</option>
                @endforeach
            </select>
        </div>
        <div class="col-md-2">
            <label class="form-label"><small>Search by Name</small></label>
            <select wire:model="searchByName" class="form-control">
                <option value="" disabled>Select Name</option>
                @foreach($patients as $patient)
                <option value="{{ $patient->name }}">{{ $patient->name }}</option>
                @endforeach
            </select>
        </div>
        <div class="col-md-4">
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

    <!-- Table displaying Patient details -->
    <div class="table-responsive">
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Father's Name</th>
                    <th>Mobile</th>
                    <th>Age</th>
                    <th>Address</th>
                    <th>Register At</th>
                    @if(Auth::user()->can('patient.details'))
                    <th>Action</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($patients as $patient)
                <tr>
                    <!-- <td>{{ $loop->iteration }}</td> -->
                    <td>{{ $patient->id }}</td>
                    <td>{{ $patient->name }}</td>
                    <td>{{ $patient->father_name ?? null }}</td>
                    <td>{{ $patient->mobile ?? null }}</td>
                    <td>{{ $patient->age ?? null }}</td>
                    <td>{{ Str::limit($patient->address ?? null, 15) }}</td>
                    <td>
                        {{ $patient->created_at->format('d-m-Y') }}
                    </td>

                    <!-- Action buttons for editing and deleting -->
                    @if(Auth::user()->can('patient.details'))
                    <td>
                        @if(Auth::user()->can('patient.details'))
                        <button wire:click="showDetails({{ $patient->id }})" class="btn btn-outline-info btn-sm" data-bs-toggle="modal" data-bs-target="#detailsModal">
                            <i class="btn-icon-prepend" data-feather="info" style="width: 16px; height: 16px;"></i> Details
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
    @if(!$search) {{ $patients->links() }} @endif

    <!-- Patient Details Modal -->
    <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog" aria-labelledby="detailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <!-- Header -->
                <div class="modal-header text-white">
                    <h5 class="modal-title" id="detailsModalLabel">Patient Details</h5>
                    <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
                </div>
                <!-- Body -->
                <div class="modal-body p-2">
                    <!-- Patient Information in Two-Column Grid -->
                    <div class="row g-3">
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>ID:</strong> {{ $selectedPatient?->id }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Name:</strong> {{ $selectedPatient?->name }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Father's Name:</strong> {{ $selectedPatient?->father_name }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Mobile:</strong> {{ $selectedPatient?->mobile }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Email:</strong> {{ $selectedPatient?->email }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Age:</strong> {{ $selectedPatient?->age }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Gender:</strong> {{ ucfirst($selectedPatient?->gender) }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Address:</strong> {{ $selectedPatient?->address }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>City:</strong> {{ $selectedPatient?->city }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>State:</strong> {{ $selectedPatient?->state }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Zip Code:</strong> {{ $selectedPatient?->zip_code }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Emergency Contact Name:</strong> {{ $selectedPatient?->emergency_contact_name }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Emergency Contact Number:</strong> {{ $selectedPatient?->emergency_contact_number }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Created By:</strong> {{ $selectedPatient?->user->name }}
                            </div>
                        </div>
                    </div>
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

    <!-- Search Patient Modal -->
    <div wire:ignore.self class="modal fade" id="searchModal" tabindex="-1" role="dialog" aria-labelledby="searchModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-xl" role="document">
            <div class="modal-content">
                <!-- Header -->
                <div class="modal-header text-white">
                    <h5 class="modal-title" id="searchModalLabel">Patient Details</h5>
                    @if(Auth::user()->can('patient.add'))
                    <div class="col-md-3 text-end">
                        <div class="btn-group" role="group">
                            <button class="btn btn-outline-success btn-icon-text btn-sm" wire:click="excel">Excel</button>
                            <button class="btn btn-outline-danger btn-icon-text btn-sm" wire:click="pdf">PDF</button>
                            <button class="btn btn-outline-secondary btn-icon-text btn-sm" wire:click="print">Print</button>
                        </div>
                    </div>
                    @endif
                    <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeSearchModal"></button>
                </div>
                <!-- Body -->
                <div class="modal-body p-2" style="max-height: 400px; overflow-y: auto;">
                    <table class="table table-bordered">
                        <thead>
                            <tr>
                                <th>Code</th>
                                <th>Name</th>
                                <th>Father's Name</th>
                                <th>Mobile</th>
                                <th>Age</th>
                                <th>Address</th>
                                <th>Register At</th>
                            </tr>
                        </thead>
                        <tbody>
                            @forelse($searchResults as $patient)
                            <tr>
                                <td>{{ $patient->id }}</td>
                                <td>{{ $patient->name }}</td>
                                <td>{{ $patient->father_name ?? null }}</td>
                                <td>{{ $patient->mobile ?? null }}</td>
                                <td>{{ $patient->age ?? null }}</td>
                                <td>{{ Str::limit($patient->address ?? null, 15) }}</td>
                                <td>{{ $patient->created_at->format('d-m-Y') }}</td>
                            </tr>
                            @empty
                            <tr>
                                <td colspan="8" class="text-center">No records found.</td>
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
    document.addEventListener('livewire:load', function() {
        window.addEventListener('open-modal', event => {
            let modalId = event.detail || 'modal';
            var modal = new bootstrap.Modal(document.getElementById(modalId));
            modal.show();
        });

        window.addEventListener('close-modal', event => {
            let modalId = event.detail || 'modal';
            var modal = bootstrap.Modal.getInstance(document.getElementById(modalId));
            if (modal) modal.hide();
        });
    });

    window.addEventListener('save-modal', () => {
        var modal = bootstrap.Modal.getInstance(document.getElementById('modal'));
        if (modal) modal.hide();
        feather.replace();
    });
</script>

<script>
    window.addEventListener('print-patient-report', event => {
        var printWindow = window.open("{{ route('livewire.reception.patient_reports.print') }}", "_blank");
        printWindow.focus();
        printWindow.onload = function() {
            // Not auto-printing, just opening the page with print button
        };
    });
</script>