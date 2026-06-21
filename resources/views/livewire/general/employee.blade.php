<div class="container">
    <div class="row mb-1">
        @if(Auth::user()->can('employee.add') )
        <div class="col-md-1">
            <button class="btn btn-outline-primary btn-icon-text btn-sm" wire:click="create" data-bs-toggle="modal" data-bs-target="#modal" wire:ignore>
                <i class="btn-icon-prepend" data-feather="plus-circle"></i>Add
            </button>
        </div>
        @endif
        <div class="col-md-8 text-start">
            <h3>Employee List</h3s>
        </div>
        <div class="col-md-3">
            <input type="text" wire:model.live="search" class="form-control" placeholder="Search here...">
        </div>
    </div>

    <!-- Modal for Adding/Editing an Employee -->
    <div wire:ignore.self class="modal fade" id="modal" tabindex="-1" role="dialog" aria-labelledby="modalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalLabel">{{ $id ? 'Edit Employee' : 'Add Employee' }}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeModal()"></button>
                </div>
                <div class="modal-body">
                    <!-- Form Fields with two-column layout -->
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group mb-1">
                                <label for="first_name">First Name <span class="text-danger">*</span></label>
                                <input type="text" wire:model="first_name" id="first_name" class="form-control mt-1" placeholder="i.e Sajed">
                                @error('first_name') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group mb-1">
                                <label for="last_name">Last Name</label>
                                <input type="text" wire:model="last_name" id="last_name" class="form-control mt-1" placeholder="i.e. Ziarmal">
                                @error('last_name') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                    </div>

                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group mb-1">
                                <label for="phone_number">Phone <span class="text-danger">*</span></label>
                                <input type="Text" wire:model="phone_number" id="phone_number" class="form-control mt-1" placeholder="i.e. 0772757573">
                                @error('phone_number') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group mb-1">
                                <label for="email">Email <span class="text-danger">*</span></label>
                                <input type="email" wire:model="email" id="email" class="form-control mt-1" placeholder="sajed@lhc.com">
                                @error('email') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                    </div>

                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group mb-1">
                                <label for="department_id">Department <span class="text-danger">*</span></label>
                                <select wire:model="department_id" id="department_id" class="form-control mt-1">
                                    <option value="">Select Department</option>
                                    @foreach($departments as $department)
                                    <option value="{{ $department->id }}">{{ $department->name }}</option>
                                    @endforeach
                                </select>
                                @error('department_id') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group mb-1">
                                <label for="designation_id">Designation <span class="text-danger">*</span></label>
                                <select wire:model="designation_id" id="designation_id" class="form-control mt-1">
                                    <option value="">Select Designation</option>
                                    @foreach($disgnations as $designation)
                                    <option value="{{ $designation->id }}">{{ $designation->name }}</option>
                                    @endforeach
                                </select>
                                @error('designation_id') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                    </div>

                    <!-- Additional Rows as Needed -->
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group mb-1">
                                <label for="specialty">Specialty</label>
                                <input type="text" wire:model="specialty" id="specialty" class="form-control mt-1" placeholder="i.e. ENT">
                                @error('specialty') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group mb-1">
                                <label for="experience_years">Experience Years</label>
                                <input type="number" wire:model="experience_years" id="experience_years" class="form-control mt-1" placeholder="i.e. 10">
                                @error('experience_years') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                    </div>

                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group mb-1">
                                <label for="hire_date">Hiring Date <span class="text-danger">*</span></label>
                                <input type="date" wire:model="hire_date" id="hire_date" class="form-control mt-1">
                                @error('hire_date') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group mb-1">
                                <label for="is_active">Status</label>
                                <select wire:model="is_active" id="is_active" class="form-control mt-1">
                                    <option value="1">Active</option>
                                    <option value="0">Inactive</option>
                                </select>
                                @error('is_active') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-12">
                        <div class="form-group mb-1">
                            <label for="address">Adrress</label>
                            <textarea wire:model="address" id="address" class="form-control mt-1" placeholder="Enter full address..." rows="2"></textarea>
                            @error('address') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>
                </div>
                <div class="modal-footer mt-3">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" wire:click="{{ $id ? 'update' : 'add' }}" class="btn btn-success">
                        {{ $id ? 'Update' : 'Save' }}
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Employee Table -->
    <div class="table-responsive">
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>S.No</th>
                    <th>First Name</th>
                    <th>Employee Code</th>
                    <th>Email</th>
                    @if(Auth::user()->can('employee.edit') || Auth::user()->can('employee.delete')|| Auth::user()->can('employee.details'))
                    <th>Action</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($employees as $employee)
                <tr>
                    <td>{{ $loop->iteration }}</td>
                    <td>{{ $employee->first_name ?? 'N/A' }}</td>
                    <td>{{ $employee->employee_code }}</td>
                    <td>{{ $employee->email }}</td>
                    @if(Auth::user()->can('employee.edit') || Auth::user()->can('employee.delete')|| Auth::user()->can('employee.details'))
                    <td>
                        @if(Auth::user()->can('employee.details'))
                        <button wire:click="showDetails({{ $employee->id }})" class="btn btn-info btn-sm" data-bs-toggle="modal" data-bs-target="#detailsModal">Details</button>
                        @endif
                        @if(Auth::user()->can('employee.edit'))
                        <button wire:click="edit({{ $employee->id }})" class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#modal" title="Edit">Edit</button>
                        @endif
                        @if(Auth::user()->can('employee.delete'))
                        <button wire:click="delete({{ $employee->id }})" class="btn btn-danger btn-sm" title="Delete">Delete</button>
                        @endif
                    </td>
                    @endif
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    {{ $employees->links() }}

    <!-- Details Modal -->
    <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog" aria-labelledby="detailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header text-white">
                    <h5 class="modal-title" id="detailsModalLabel">Employee Details</h5>
                    <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
                </div>
                <div class="modal-body p-2">
                    <!-- Employee Details Grid -->
                    <div class="row g-3">
                        <div class="col-md-6">
                            <div class="p-3 rounded border"><strong>First Name:</strong> {{ $selectedEmployee?->first_name }}</div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border"><strong>Employee Code:</strong> {{ $selectedEmployee?->employee_code }}</div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border"><strong>Email:</strong> {{ $selectedEmployee?->email }}</div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border"><strong>Department:</strong> {{ $selectedEmployee?->Department->name }}</div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border"><strong>Designation:</strong> {{ $selectedEmployee?->Designation->name }}</div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border"><strong>Specialty:</strong> {{ $selectedEmployee?->specialty }}</div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border"><strong>Experience Years:</strong> {{ $selectedEmployee?->experience_years }}</div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border"><strong>Phone:</strong> {{ $selectedEmployee?->phone_number }}</div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border"><strong>Address:</strong> {{ $selectedEmployee?->address }}</div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border"><strong>Hire Date:</strong> {{ $selectedEmployee?->hire_date }}</div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer d-flex justify-content-between">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
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
    });
</script>