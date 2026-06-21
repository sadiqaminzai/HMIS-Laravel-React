<div class="container">
    <div class="row mb-1">
        @if(Auth::user()->can('pharmacy.supplier.add') )

        <div class="col-md-1">
            <button class="btn btn-outline-primary btn-icon-text btn-sm" wire:click="create" data-bs-toggle="modal" data-bs-target="#modal" wire:ignore>
                <i class="btn-icon-prepend" data-feather="plus-circle"></i>Add
            </button>
        </div>
        @endif
        <div class="col-md-8 text-start">
            <h3>Supplier List</h3s>
        </div>
        <div class="col-md-3">
            <input type="text" wire:model.live="search" class="form-control" placeholder="Search here...">
        </div>
    </div>

    <!-- Bootstrap Modal for creating or editing a Supplier -->
    <div wire:ignore.self class="modal fade" id="modal" tabindex="-1" role="dialog" aria-labelledby="modalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalLabel">{{ $id ? 'Edit Supplier' : 'Create Supplier' }}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeModal()"></button>
                </div>
                <div class="modal-body">
                    <!-- Supplier Name Input -->
                    <div class="form-group mb-1">
                        <label for="name">Name</label>
                        <input type="text" wire:model="name" id="name" class="form-control mt-1" placeholder="Enter name...">
                        @error('name') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>


                    <!-- Phone, EMail, Address, CompanyName -->
                    <div class="form-group mb-1">
                        <label for="phone">Phone</label>
                        <input type="text" wire:model="phone" id="phone" class="form-control mt-1" placeholder="Enter phone...">
                        @error('phone') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>

                    <div class="form-group mb-1">
                        <label for="email">Email</label>
                        <input type="email" wire:model="email" id="email" class="form-control mt-1" placeholder="Enter email...">
                        @error('email') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>

                    <div class="form-group mb-1">
                        <label for="address">Address</label>
                        <input type="text" wire:model="address" id="address" class="form-control mt-1" placeholder="Enter address...">
                        @error('address') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>

                    <div class="form-group mb-1">
                        <label for="company_name">Company Name</label>
                        <input type="text" wire:model="company_name" id="company_name" class="form-control mt-1" placeholder="Enter company name...">
                        @error('company_name') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>

                    <!-- Div for Status Input -->
                    <div class="form-group mb-1">
                        <label for="is_active">Status</label>
                        <select wire:model="is_active" id="is_active" class="form-control mt-1">
                            <option value="1">Active</option>
                            <option value="0">Inactive</option>
                        </select>
                        @error('is_active') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>


                    <!-- Created By (Auto-filled, just for display) -->
                    @if($id)
                    <p>Created By: {{ Auth::user()->name }}</p>
                    @endif
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

    <!-- Table displaying Supplier details -->
    <div class="table-responsive">
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>S.No</th>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Company Name</th>
                    <th>Staus</th>
                    @if(Auth::user()->can('pharmacy.supplier.edit') || Auth::user()->can('pharmacy.supplier.delete')|| Auth::user()->can('pharmacy.supplier.details'))

                    <th>Action</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($suppliers as $supplier)
                <tr>
                    <td>
                        <!-- Display S.No start from 1 -->
                        {{ $loop->iteration }}
                    </td>
                    <!-- Display Supplier name -->
                    <td>{{ $supplier->id }}</td>

                    <!-- Display Supplier name -->
                    <td>{{ $supplier->name }}</td>

                    <!-- Phone, EMail, Address, CompanyName -->
                    <td>{{ $supplier->phone }}</td>
                    <td>{{ $supplier->company_name}}</td>

                    <!-- Status if is_active = 1 means active else inactive -->
                    <td>
                        {!! $supplier->is_active == 1 ?
                        '<span class="badge bg-success">Active</span>' :
                        '<span class="badge bg-danger">Inactive</span>' !!}
                    </td>

                    <!-- Display Supplier creator's name -->
                    <!-- Action buttons for editing and deleting -->
                    @if(Auth::user()->can('pharmacy.supplier.edit') || Auth::user()->can('pharmacy.supplier.delete')|| Auth::user()->can('spharmacy.supplier.details'))

                    <td>
                        @if(Auth::user()->can('pharmacy.supplier.edit') )
                        <button wire:click="edit({{ $supplier->id }})" class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#modal" title="Edit">Edit</button>
                       @endif

                        @if(Auth::user()->can('pharmacy.supplier.delete') )

                        <button wire:click="delete({{ $supplier->id }})" class="btn btn-danger btn-sm" title="Delete">Delete</button>
                        @endif
                        @if(Auth::user()->can('pharmacy.supplier.details') )

                        <button wire:click="showDetails({{ $supplier->id }})" class="btn btn-info btn-sm" data-bs-toggle="modal" data-bs-target="#detailsModal">
                            Details
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
    {{ $suppliers->links() }}
    <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog" aria-labelledby="detailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <!-- Header -->
                <div class="modal-header text-white">
                    <h5 class="modal-title" id="detailsModalLabel">Supplier Details</h5>
                    <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
                </div>

                <!-- Body -->
                <div class="modal-body p-2">
                    <!-- Supplier Information in Two-Column Grid -->
                    <div class="row g-3">
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>ID:</strong> {{ $selectedSupplier?->id }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Name:</strong> {{ $selectedSupplier?->name }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Phone:</strong> {{ $selectedSupplier?->phone }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Email:</strong> {{ $selectedSupplier?->email }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Address:</strong> {{ $selectedSupplier?->address }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Company Name:</strong> {{ $selectedSupplier?->company_name }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Created By:</strong> {{ $selectedSupplier?->user->name }}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
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
