<div class="container">
    <div class="row mb-1">
    @if(Auth::user()->can('fee.add') )
        <div class="col-md-1">
            <button class="btn btn-outline-primary btn-icon-text btn-sm" wire:click="create" data-bs-toggle="modal" data-bs-target="#modal" wire:ignore>
                <i class="btn-icon-prepend" data-feather="plus-circle"></i>Add
            </button>
        </div>
    @endif
        <div class="col-md-8 text-start">
            <h3>Doctor Fees List</h3s>
        </div>
        <div class="col-md-3">
            <input type="text" wire:model.live="search" class="form-control" placeholder="Search here...">
        </div>
    </div>

    <!-- Bootstrap Modal for creating or editing a Packing -->
    <div wire:ignore.self class="modal fade" id="modal" tabindex="-1" role="dialog" aria-labelledby="modalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document"> <!-- Added modal-lg class for larger width -->
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalLabel">{{ $id ? 'Edit Fees' : 'Create Fees' }}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeModal()"></button>
                </div>

                <div class="modal-body">
                    <div class="row">
                        <!-- Employee Dropdown Input -->
                        <div class="col-md-6 form-group mb-1">
                            <label for="employee_id">Doctor <span class="text-danger fw-300"> *</span></label>
                            <select wire:model="employee_id" id="employee_id" class="form-control mt-1">
                                <option value="" disabled>Select doctor</option>
                                @foreach($employees as $employee)
                                    <option value="{{ $employee->id }}">{{ $employee->first_name ?? '' }} {{ $employee->last_name ?? '' }}</option>
                                @endforeach
                            </select>
                            @error('employee_id') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>

                        <!-- Fees Amount Input -->
                        <div class="col-md-6 form-group mb-1">
                            <label for="amount">Amount <span class="text-danger fw-300"> *</span></label>
                            <input type="text" wire:model="amount" id="amount" class="form-control mt-1" placeholder="i.e. 1000">
                            @error('amount') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="row">
                        <!-- Fees Currency Input -->
                        <div class="col-md-6 form-group mb-1">
                            <label for="currency">Currency</label>
                            <input type="text" wire:model="currency" id="currency" class="form-control mt-1" placeholder="i.e. AFN">
                            @error('currency') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>

                        <!-- Fees Description Input -->
                        <div class="col-md-6 form-group mb-1">
                            <label for="description">Description</label>
                            <input type="text" wire:model="description" id="description" class="form-control mt-1" placeholder="i.e. Consultation Fees">
                            @error('description') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                  <!--
                    NOTE:
                    Employee_ID and Department_ID should be added here
                    -->

                    <div class="row">
                        <!-- Status Input -->
                        <div class="col-md-6 form-group mb-1">
                            <label for="is_active">Status</label>
                            <select wire:model="is_active" id="is_active" class="form-control mt-1">
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                            @error('is_active') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>

                        <!-- Created By (Auto-filled, just for display) -->
                        @if($id)
                        <div class="col-md-6 form-group mb-1">
                            <p>Created By: {{ Auth::user()->name }}</p>
                        </div>
                        @endif
                    </div>
                </div>
                <div class="modal-footer mt-3">
                    <!-- Cancel Button -->
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <!-- Save Button -->
                    <button type="button" wire:click="{{ $id ? 'update' : 'add' }}" class="btn btn-success">
                        {{ ($id) ? 'Update' : 'Save' }}
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Table displaying Fee details -->
    <div class="table-responsive">
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>Code</th>
                    <th>Doctor Name</th>
                    <th>Amount</th>
                    <th>Currency</th>
                    <th>Description</th>
                    <th>Staus</th>
                    <th>Created By</th>
                    @if(Auth::user()->can('fee.delete') || Auth::user()->can('fee.edit'))
                    <th>Action</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($fees as $fee)
                <tr>
                    <!-- <td>{{ $loop->iteration }}</td> -->
                    <td>{{ $fee->id }}</td>
                    <td>{{ ($fee->employee) ? ($fee->employee->first_name ?? '') . ' ' . ($fee->employee->last_name ?? '') : 'Unknown' }}</td>
                    <td>{{ $fee->amount }}</td>
                    <td>{{ $fee->currency ?? null }}</td>
                    <td>{{ $fee->description ?? null }}</td>
                    <td>{!! $fee->is_active == 1 ?
                        '<span class="badge bg-success">Active</span>' : '<span class="badge bg-danger">Inactive</span>' !!}
                    </td>
                    <td>{{ ($fee->user) ? $fee->user->name : 'Unknown' }}</td>

                    <!-- Action buttons for editing and deleting -->
                    @if(Auth::user()->can('fee.delete') || Auth::user()->can('fee.edit'))

                    <td>
                        @if(Auth::user()->can('fee.edit') )
                        <button wire:click="edit({{ $fee->id }})" class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#modal" title="Edit">Edit</button>
                        @endif
                        @if(Auth::user()->can('fee.delete') )
                        <button wire:click="delete({{ $fee->id }})" class="btn btn-danger btn-sm" title="Delete">Delete</button>
                        @endif
                    </td>
                    @endif
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <!-- Pagination Links -->
    {{ $fees->links() }}
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
