<div class="container-fluid">
    <!-- Page title and Search dropdowns -->
    <div class="row mb-2 text-center">
        <div class="col-md-6 text-start">
            <h3>Surgery Management</h3>
        </div>
        <div class="col-md-6 ">
        </div>
      
    </div>

    <!-- Search filters -->
    <div class="row g-2 mb-2">
        <!-- First Row -->
        <div class="col-md-3">
            <label class="form-label"><small>Dynamic Search</small></label>
            <input type="text" wire:model.live="search" class="form-control" placeholder="Patient/Surgery/Doctor name...">
        </div>

        <div class="col-md-3">
            <label class="form-label"><small>Search by ID</small></label>
            <select wire:model="searchById" class="form-select form-select-sm">
                <option value="">Select ID</option>
                @foreach($patientSurgeries as $ps)
                <option value="{{ $ps->id }}">{{ $ps->id }}</option>
                @endforeach
            </select>
        </div>
        
        <div class="col-md-3">
            <label class="form-label"><small>ID Range</small></label>
            <div class="d-flex gap-1">
                <select wire:model="searchFromId" class="form-select form-select-sm">
                    <option value="">From</option>
                    @foreach($patientSurgeries as $ps)
                    <option value="{{ $ps->id }}">{{ $ps->id }}</option>
                    @endforeach
                </select>
                <select wire:model="searchToId" class="form-select form-select-sm">
                    <option value="">To</option>
                    @foreach($patientSurgeries as $ps)
                    <option value="{{ $ps->id }}">{{ $ps->id }}</option>
                    @endforeach
                </select>
            </div>
        </div>
        
        <div class="col-md-3">
            <label class="form-label"><small>Search by Patient</small></label>
            <select wire:model="searchByPatient" class="form-select form-select-sm">
                <option value="">Select Patient</option>
                @foreach($patients as $patient)
                <option value="{{ $patient->name }}">{{ $patient->name }}</option>
                @endforeach
            </select>
        </div>
    </div>

    <div class="row g-2 mb-3">
        <!-- Second Row -->
        <div class="col-md-2">
            <label class="form-label"><small>Search by Doctor</small></label>
            <select wire:model="searchByDoctor" class="form-select form-select-sm">
                <option value="">Select Doctor</option>
                @foreach($doctors as $doctor)
                <option value="{{ $doctor->first_name }} {{ $doctor->last_name }}">{{ $doctor->first_name }} {{ $doctor->last_name }}</option>
                @endforeach
            </select>
        </div>
        
        <div class="col-md-2">
            <label class="form-label"><small>Search by Surgery</small></label>
            <select wire:model="searchBySurgery" class="form-select form-select-sm">
                <option value="">Select Surgery</option>
                @foreach($surgeries as $surgery)
                <option value="{{ $surgery->name }}">{{ $surgery->name }}</option>
                @endforeach
            </select>
        </div>
        
        <div class="col-md-2">
            <label class="form-label"><small>Payment Status</small></label>
            <select wire:model="searchByPaymentStatus" class="form-select form-select-sm">
                <option value="">All Payment Statuses</option>
                <option value="pending">Pending</option>
                <option value="partial">Partial</option>
                <option value="paid">Paid</option>
                <option value="cancelled">Cancelled</option>
            </select>
        </div>
        
        <div class="col-md-4">
            <label class="form-label"><small>Date Range</small></label>
            <div class="d-flex gap-1">
                <input type="date" wire:model="searchFromDate" class="form-control form-control-sm" placeholder="From">
                <input type="date" wire:model="searchToDate" class="form-control form-control-sm" placeholder="To">
            </div>
        </div>
        
        <div class="col-md-4 d-flex align-items-end">
            <div class="btn-group" role="group">
                <button wire:click="searchDetails" class="btn btn-outline-info btn-sm" data-bs-toggle="modal" data-bs-target="#searchModal">
                    <i data-feather="search" style="width: 16px; height: 16px;"></i> Search
                </button>
                <button class="btn btn-outline-secondary btn-sm" wire:click="resetFilters">
                    <i data-feather="refresh-cw" style="width: 16px; height: 16px;"></i> Reset
                </button>
            </div>
        </div>
    </div>

 
    
    <!-- Patient Surgeries Section -->
    <div class="row mt-4 mb-3">
        <div class="col-md-12">
            <div class="d-flex justify-content-between align-items-center">
                <h4>Patient Surgeries</h4>
                <button class="btn btn-outline-info btn-icon-text btn-sm" wire:click="createPatientSurgery" data-bs-toggle="modal" data-bs-target="#patientSurgeryModal">
                    <i class="btn-icon-prepend" data-feather="user-plus"></i> Add Patient Surgery
                </button>
            </div>
        </div>
    </div>

    <!-- Main Table: List of Patient Surgeries -->
    <div class="table-responsive">
        <table class="table table-bordered">
            <thead>
                <tr class="">
                    <th>ID</th>
                    <th>Patient</th>
                    <th>Surgery</th>
                    <th>Doctor</th>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Payment</th>
                    <th>Cost</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                @forelse($patientSurgeries as $ps)
                <tr>
                    <td>{{ $ps->id }}</td>
                    <td>{{ $ps->patient->name }}</td>
                    <td>{{ $ps->surgery->name }}</td>
                    <td>{{ $ps->doctor ? $ps->doctor->first_name.' '.$ps->doctor->last_name : 'Not Assigned' }}</td>
                    <td>{{ $ps->surgery->surgeryType ? $ps->surgery->surgeryType->name : $ps->surgery->old_type }}</td>
                    <td>{{ $ps->surgery_date }}</td>
                    <td>
                        <span class="badge bg-{{ $ps->status == 'completed' ? 'success' : ($ps->status == 'scheduled' ? 'info' : 'warning') }}">
                            {{ ucfirst($ps->status) }}
                        </span>
                    </td>
                    <td>
                        <span class="badge bg-{{ $ps->payment_status == 'paid' ? 'success' : ($ps->payment_status == 'pending' ? 'warning' : ($ps->payment_status == 'partial' ? 'info' : 'danger')) }}">
                            {{ ucfirst($ps->payment_status) }}
                        </span>
                    </td>
                    <td>{{ number_format($ps->cost, 2) }}</td>
                    <td>
                        <button wire:click="showDetails({{ $ps->id }})" class="btn btn-sm btn-outline-info" data-bs-toggle="modal" data-bs-target="#detailsModal">
                            <i data-feather="eye" style="width: 14px; height: 14px;"></i>
                        </button>
                        <button wire:click="editPatientSurgery({{ $ps->id }})" class="btn btn-sm btn-outline-warning" data-bs-toggle="modal" data-bs-target="#patientSurgeryModal">
                            <i data-feather="edit" style="width: 14px; height: 14px;"></i>
                        </button>
                        <button wire:click="togglePaymentStatus({{ $ps->id }})" class="btn btn-sm {{ $ps->payment_status === 'pending' ? 'btn-outline-success' : 'btn-outline-warning' }}" title="{{ $ps->payment_status === 'pending' ? 'Mark as Paid' : 'Mark as Pending' }}">
                            <i data-feather="{{ $ps->payment_status === 'pending' ? 'dollar-sign' : 'credit-card' }}" style="width: 14px; height: 14px;"></i>
                        </button>
                        <button wire:click="deletePatientSurgery({{ $ps->id }})" class="btn btn-sm btn-outline-danger" onclick="return confirm('Are you sure you want to delete this record?')">
                            <i data-feather="trash-2" style="width: 14px; height: 14px;"></i>
                        </button>
                    </td>
                </tr>
                @empty
                <tr>
                    <td colspan="10" class="text-center">No surgery records found.</td>
                </tr>
                @endforelse
            </tbody>
        </table>
    </div>

    <!-- Pagination Links -->
    @if(!$search)
        <div class="mt-2">
            {{ $patientSurgeries->links() }}
        </div>
    @endif

    <!-- Surgery Type Management Section -->
    <div class="row mt-4">
        <div class="col-md-12">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h4>Surgery Types</h4>
                <button wire:click="createSurgeryType" class="btn btn-outline-primary btn-sm" data-bs-toggle="modal" data-bs-target="#surgeryTypeModal">
                    <i data-feather="plus-circle" style="width: 16px; height: 16px;"></i> Add Surgery Type
                </button>
            </div>
            <div class="table-responsive">
                <table class="table table-bordered table-sm">
                    <thead>
                        <tr class="">
                            <th>ID</th>
                            <th>Name</th>
                            <th>Description</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($surgeryTypes as $type)
                        <tr>
                            <td>{{ $type->id }}</td>
                            <td>{{ $type->name }}</td>
                            <td>{{ Str::limit($type->description, 50) }}</td>
                            <td>
                                <button wire:click="editSurgeryType({{ $type->id }})" class="btn btn-sm btn-outline-warning" data-bs-toggle="modal" data-bs-target="#surgeryTypeModal">
                                    <i data-feather="edit" style="width: 14px; height: 14px;"></i>
                                </button>
                                <button wire:click="deleteSurgeryType({{ $type->id }})" class="btn btn-sm btn-outline-danger" onclick="return confirm('Are you sure you want to delete this surgery type?')">
                                    <i data-feather="trash-2" style="width: 14px; height: 14px;"></i>
                                </button>
                            </td>
                        </tr>
                        @empty
                        <tr>
                            <td colspan="4" class="text-center">No surgery types available.</td>
                        </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Surgeries Management Section -->
    <div class="row mt-4">
        <div class="col-md-12">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <h4>Available Surgeries</h4>
                <button wire:click="createSurgery" class="btn btn-outline-primary btn-sm" data-bs-toggle="modal" data-bs-target="#surgeryModal">
                    <i data-feather="plus-circle" style="width: 16px; height: 16px;"></i> Add Surgery
                </button>
            </div>
            <div class="table-responsive">
                <table class="table table-bordered table-sm">
                    <thead>
                        <tr class="">
                            <th>Name</th>
                            <th>Type</th>
                            <th>Cost</th>
                            <th>Description</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($surgeries as $surgery)
                        <tr>
                            <td>{{ $surgery->name }}</td>
                            <td>{{ $surgery->surgeryType ? $surgery->surgeryType->name : $surgery->old_type }}</td>
                            <td>{{ number_format($surgery->cost, 2) }}</td>
                            <td>{{ Str::limit($surgery->description, 50) }}</td>
                            <td>
                                <button wire:click="editSurgery({{ $surgery->id }})" class="btn btn-sm btn-outline-warning" data-bs-toggle="modal" data-bs-target="#surgeryModal">
                                    <i data-feather="edit" style="width: 14px; height: 14px;"></i>
                                </button>
                                <button wire:click="deleteSurgery({{ $surgery->id }})" class="btn btn-sm btn-outline-danger" onclick="return confirm('Are you sure you want to delete this surgery?')">
                                    <i data-feather="trash-2" style="width: 14px; height: 14px;"></i>
                                </button>
                            </td>
                        </tr>
                        @empty
                        <tr>
                            <td colspan="5" class="text-center">No surgeries available.</td>
                        </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <!-- Surgery Modal -->
    <div wire:ignore.self class="modal fade" id="surgeryModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">{{ $surgery_id ? 'Edit Surgery' : 'Add Surgery' }}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <form wire:submit.prevent="saveSurgery">
                        <div class="mb-3">
                            <label for="name" class="form-label">Surgery Name</label>
                            <input type="text" class="form-control" id="name" wire:model="name">
                            @error('name') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                        <div class="mb-3">
                            <label for="type_id" class="form-label">Surgery Type</label>
                            <select class="form-control" id="type_id" wire:model="type_id">
                                <option value="">Select Type</option>
                                @foreach($surgeryTypes as $type)
                                <option value="{{ $type->id }}">{{ $type->name }}</option>
                                @endforeach
                            </select>
                            @error('type_id') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                        <div class="mb-3">
                            <label for="cost" class="form-label">Cost</label>
                            <input type="number" step="0.01" class="form-control" id="cost" wire:model="cost">
                            @error('cost') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                        <div class="mb-3">
                            <label for="description" class="form-label">Description</label>
                            <textarea class="form-control" id="description" wire:model="description" rows="3"></textarea>
                            @error('description') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                        <div class="d-flex justify-content-end">
                            <button type="button" class="btn btn-secondary me-2" data-bs-dismiss="modal">Cancel</button>
                            <button type="submit" class="btn btn-primary">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <!-- Patient Surgery Modal -->
    <div wire:ignore.self class="modal fade" id="patientSurgeryModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">{{ $patientSurgeryId ? 'Edit Patient Surgery' : 'Assign Surgery to Patient' }}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <form wire:submit.prevent="savePatientSurgery">
                        <div class="row mb-3">
                            <div class="col-md-4">
                                <label for="patient_lookup" class="form-label">Search Patient by ID</label>
                                <div class="input-group">
                                    <input type="text" class="form-control" id="patient_lookup" wire:model.live="patientLookupId" wire:keydown.enter.prevent="lookupPatient" placeholder="Patient ID">
                                    <button type="button" class="btn btn-primary" wire:click="lookupPatient">
                                        <i data-feather="search" style="width: 14px; height: 14px;"></i>
                                    </button>
                                </div>
                                @if($patientLookupError)
                                <small class="text-danger">{{ $patientLookupError }}</small>
                                @endif
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="patient_id" class="form-label">Patient</label>
                                <select class="form-control" id="patient_id" wire:model="patient_id">
                                    <option value="">Select Patient</option>
                                    @foreach($patients as $patient)
                                    <option value="{{ $patient->id }}">{{ $patient->name }}</option>
                                    @endforeach
                                </select>
                                @error('patient_id') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="doctor_id" class="form-label">Doctor</label>
                                <select class="form-control" id="doctor_id" wire:model="doctor_id">
                                    <option value="">Select Doctor</option>
                                    @foreach($doctors as $doctor)
                                    <option value="{{ $doctor->id }}">{{ $doctor->first_name }} {{ $doctor->last_name }}</option>
                                    @endforeach
                                </select>
                                @error('doctor_id') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="surgery_id" class="form-label">Surgery</label>
                                <select class="form-control" id="surgery_id" wire:model="surgery_id">
                                    <option value="">Select Surgery</option>
                                    @foreach($surgeries as $surgery)
                                    <option value="{{ $surgery->id }}">{{ $surgery->name }} ({{ $surgery->surgeryType ? $surgery->surgeryType->name : $surgery->old_type }}) - ${{ number_format($surgery->cost, 2) }}</option>
                                    @endforeach
                                </select>
                                @error('surgery_id') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="surgery_date" class="form-label">Surgery Date</label>
                                <input type="date" class="form-control" id="surgery_date" wire:model="surgery_date">
                                @error('surgery_date') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="status" class="form-label">Status</label>
                                <select class="form-control" id="status" wire:model="status">
                                    <option value="scheduled">Scheduled</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                                @error('status') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                            <div class="col-md-6 mb-3">
                                <label for="payment_status" class="form-label">Payment Status</label>
                                <select class="form-control" id="payment_status" wire:model="payment_status">
                                    <option value="pending">Pending</option>
                                    <option value="partial">Partial</option>
                                    <option value="paid">Paid</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                                @error('payment_status') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                        <div class="row">
                            <div class="col-md-6 mb-3">
                                <label for="total_cost" class="form-label">Cost (Leave empty for default)</label>
                                <input type="number" step="0.01" class="form-control" id="total_cost" wire:model="total_cost" placeholder="If different from standard cost">
                                @error('total_cost') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                        <div class="mb-3">
                            <label for="notes" class="form-label">Notes</label>
                            <textarea class="form-control" id="notes" wire:model="notes" rows="3"></textarea>
                            @error('notes') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                        <div class="d-flex justify-content-end">
                            <button type="button" class="btn btn-secondary me-2" data-bs-dismiss="modal">Cancel</button>
                            <button type="submit" class="btn btn-primary">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <!-- Details Modal -->
    <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Surgery Details</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
                </div>
                <div class="modal-body p-4">
                    @if($selected_data)
                    <div class="row g-4">
                        <!-- Patient Information -->
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Patient Name:</strong> <span class="text-primary">{{ $selected_data->patient->name }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Doctor:</strong> <span class="text-primary">{{ $selected_data->doctor ? $selected_data->doctor->first_name.' '.$selected_data->doctor->last_name : 'Not Assigned' }}</span>
                            </div>
                        </div>

                        <!-- Surgery Information -->
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Surgery:</strong> <span class="text-primary">{{ $selected_data->surgery->name }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Surgery Type:</strong> <span class="text-success">{{ $selected_data->surgery->surgeryType ? $selected_data->surgery->surgeryType->name : $selected_data->surgery->old_type }}</span>
                            </div>
                        </div>

                        <!-- Date and Status Information -->
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Surgery Date:</strong> <span class="text-success">{{ $selected_data->surgery_date }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Status:</strong>
                                <span class="badge bg-{{ $selected_data->status == 'completed' ? 'success' : ($selected_data->status == 'scheduled' ? 'info' : 'warning') }}">
                                    {{ ucfirst($selected_data->status) }}
                                </span>
                            </div>
                        </div>

                        <!-- Payment Status -->
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Payment Status:</strong>
                                <span class="badge bg-{{ $selected_data->payment_status == 'paid' ? 'success' : ($selected_data->payment_status == 'pending' ? 'warning' : ($selected_data->payment_status == 'partial' ? 'info' : 'danger')) }}">
                                    {{ ucfirst($selected_data->payment_status) }}
                                </span>
                            </div>
                        </div>

                        <!-- Cost -->
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Cost:</strong> <span class="text-primary">${{ number_format($selected_data->cost, 2) }}</span>
                            </div>
                        </div>

                        <!-- Notes -->
                        <div class="col-md-12">
                            <div class="p-3 rounded border">
                                <strong>Notes:</strong> <span class="text-muted">{{ $selected_data->notes ?? 'No notes' }}</span>
                            </div>
                        </div>
                    </div>
                    @else
                    <div class="text-center p-4">
                        <p>No data available</p>
                    </div>
                    @endif
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" wire:click="closeDetailsModal">Close</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Search Results Modal -->
    <div wire:ignore.self class="modal fade" id="searchModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-xl">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">Surgery Search Results</h5>
                    <div>
                        <button class="btn btn-outline-success btn-sm me-1" onclick="window.open('{{ route('reception.surgery-print') }}', '_blank')">
                            <i data-feather="printer" style="width: 16px; height: 16px;"></i> Print
                        </button>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeSearchModal"></button>
                    </div>
                </div>
                <div class="modal-body">
                    <div class="table-responsive">
                        <table class="table table-bordered">
                            <thead>
                                <tr>
                                    <th>S.No</th>
                                    <th>ID</th>
                                    <th>Patient</th>
                                    <th>Doctor</th>
                                    <th>Surgery</th>
                                    <th>Type</th>
                                    <th>Date</th>
                                    <th>Status</th>
                                    <th>Payment</th>
                                    <th>Cost</th>
                                </tr>
                            </thead>
                            <tbody>
                                @forelse($searchResults as $index => $ps)
                                <tr>
                                    <td>{{ $index + 1 }}</td>
                                    <td>{{ $ps->id }}</td>
                                    <td>{{ $ps->patient->name }}</td>
                                    <td>{{ $ps->doctor ? $ps->doctor->first_name.' '.$ps->doctor->last_name : 'Not Assigned' }}</td>
                                    <td>{{ $ps->surgery->name }}</td>
                                    <td>{{ $ps->surgery->surgeryType ? $ps->surgery->surgeryType->name : $ps->surgery->old_type }}</td>
                                    <td>{{ $ps->surgery_date }}</td>
                                    <td>
                                        <span class="badge bg-{{ $ps->status == 'completed' ? 'success' : ($ps->status == 'scheduled' ? 'info' : 'warning') }}">
                                            {{ ucfirst($ps->status) }}
                                        </span>
                                    </td>
                                    <td>
                                        <span class="badge bg-{{ $ps->payment_status == 'paid' ? 'success' : ($ps->payment_status == 'pending' ? 'warning' : ($ps->payment_status == 'partial' ? 'info' : 'danger')) }}">
                                            {{ ucfirst($ps->payment_status) }}
                                        </span>
                                    </td>
                                    <td>${{ number_format($ps->cost, 2) }}</td>
                                </tr>
                                @empty
                                <tr>
                                    <td colspan="10" class="text-center">No matching records found.</td>
                                </tr>
                                @endforelse
                            </tbody>
                        </table>
                    </div>
                </div>
                <div class="modal-footer">
                    <div class="d-flex justify-content-between w-100">
                        <div>
                            <strong>Total Records:</strong> {{ count($searchResults) }}
                        </div>
                        <div>
                            <strong>Total Cost:</strong> ${{ number_format($totalSurgeryCost, 2) }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Surgery Type Modal -->
    <div wire:ignore.self class="modal fade" id="surgeryTypeModal" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">{{ $surgeryType_id ? 'Edit Surgery Type' : 'Add Surgery Type' }}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                </div>
                <div class="modal-body">
                    <form wire:submit.prevent="saveSurgeryType">
                        <div class="mb-3">
                            <label for="typeName" class="form-label">Type Name</label>
                            <input type="text" class="form-control" id="typeName" wire:model="typeName">
                            @error('typeName') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                        <div class="mb-3">
                            <label for="typeDescription" class="form-label">Description</label>
                            <textarea class="form-control" id="typeDescription" wire:model="typeDescription" rows="3"></textarea>
                            @error('typeDescription') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                        <div class="d-flex justify-content-end">
                            <button type="button" class="btn btn-secondary me-2" data-bs-dismiss="modal">Cancel</button>
                            <button type="submit" class="btn btn-primary">Save</button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>

    @push('scripts')
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Initialize feather icons
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
            
            // Initialize modals using Bootstrap 5 syntax
            window.surgeryModal = new bootstrap.Modal(document.getElementById('surgeryModal'));
            window.surgeryTypeModal = new bootstrap.Modal(document.getElementById('surgeryTypeModal'));
            window.patientSurgeryModal = new bootstrap.Modal(document.getElementById('patientSurgeryModal'));
            window.detailsModal = new bootstrap.Modal(document.getElementById('detailsModal'));
            window.searchModal = new bootstrap.Modal(document.getElementById('searchModal'));
        });

        document.addEventListener('livewire:initialized', function() {
            // Surgery Modal Events
            window.addEventListener('open-surgery-modal', event => {
                window.surgeryModal.show();
            });
            
            window.addEventListener('close-surgery-modal', event => {
                window.surgeryModal.hide();
            });
            
            // Surgery Type Modal Events
            window.addEventListener('open-surgery-type-modal', event => {
                window.surgeryTypeModal.show();
            });
            
            window.addEventListener('close-surgery-type-modal', event => {
                window.surgeryTypeModal.hide();
            });
            
            // Patient Surgery Modal Events
            window.addEventListener('open-patient-surgery-modal', event => {
                window.patientSurgeryModal.show();
            });
            
            window.addEventListener('close-patient-surgery-modal', event => {
                window.patientSurgeryModal.hide();
            });
            
            // Details Modal
            window.addEventListener('open-details-modal', event => {
                window.detailsModal.show();
            });
            
            // Search Modal
            window.addEventListener('open-search-modal', event => {
                window.searchModal.show();
            });
            
            // Flash Messages
            window.addEventListener('success', event => {
                // Refresh feather icons after DOM updates
                if (typeof feather !== 'undefined') {
                    setTimeout(() => feather.replace(), 100);
                }
                
                // Display success toast or alert
                if (event.detail && event.detail.message) {
                    alert(event.detail.message);
                }
            });
            
            window.addEventListener('error', event => {
                // Display error toast or alert
                if (event.detail && event.detail.message) {
                    alert(event.detail.message);
                }
            });
        });

        document.addEventListener('livewire:load', function() {
            // For Surgery Type Modal
            window.addEventListener('open-surgery-type-modal', () => {
                var surgeryTypeModal = new bootstrap.Modal(document.getElementById('surgeryTypeModal'));
                surgeryTypeModal.show();
            });
            
            window.addEventListener('close-surgery-type-modal', () => {
                var surgeryTypeModal = bootstrap.Modal.getInstance(document.getElementById('surgeryTypeModal'));
                if (surgeryTypeModal) {
                    surgeryTypeModal.hide();
                }
            });
            
            // For Surgery Modal
            window.addEventListener('open-surgery-modal', () => {
                var surgeryModal = new bootstrap.Modal(document.getElementById('surgeryModal'));
                surgeryModal.show();
            });
            
            window.addEventListener('close-surgery-modal', () => {
                var surgeryModal = bootstrap.Modal.getInstance(document.getElementById('surgeryModal'));
                if (surgeryModal) {
                    surgeryModal.hide();
                }
            });
            
            // For Patient Surgery Modal
            window.addEventListener('open-patient-surgery-modal', () => {
                var patientSurgeryModal = new bootstrap.Modal(document.getElementById('patientSurgeryModal'));
                patientSurgeryModal.show();
            });
            
            window.addEventListener('close-patient-surgery-modal', () => {
                var patientSurgeryModal = bootstrap.Modal.getInstance(document.getElementById('patientSurgeryModal'));
                if (patientSurgeryModal) {
                    patientSurgeryModal.hide();
                }
            });
            
            // For Search Modal
            window.addEventListener('open-search-modal', () => {
                var searchModal = new bootstrap.Modal(document.getElementById('searchModal'));
                searchModal.show();
            });
            
            // For Details Modal
            window.addEventListener('open-details-modal', () => {
                var detailsModal = new bootstrap.Modal(document.getElementById('detailsModal'));
                detailsModal.show();
            });

            // After any modal save
            window.addEventListener('success', event => {
                feather.replace();
            });
        });
    </script>
    @endpush
</div>