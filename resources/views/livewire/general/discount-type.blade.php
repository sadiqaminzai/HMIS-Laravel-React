<div class="container">
    <div class="row mb-1">
        <div class="col-md-1">
            <button class="btn btn-outline-primary btn-icon-text btn-sm" wire:click="create" data-bs-toggle="modal" data-bs-target="#modal" wire:ignore>
                <i class="btn-icon-prepend" data-feather="plus-circle"></i>Add
            </button>
        </div>
        <div class="col-md-8 text-start">
            <h3>Discount Type List</h3s>
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
                    <h5 class="modal-title" id="modalLabel">{{ $id ? 'Edit Discount Type' : 'Create Discount Type' }}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeModal()"></button>
                </div>

                <div class="modal-body">
                    <div class="row">
                        <!-- Name Input -->
                        <div class="col-md-6 form-group mb-1">
                            <label for="name">Name <span class="text-danger fw-300"> *</span></label>
                            <input type="text" wire:model="name" id="name" class="form-control mt-1" placeholder="i.e. Consultation">
                            @error('name') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>

                        <!-- Details Input -->
                        <div class="col-md-6 form-group mb-1">
                            <label for="details">Details</label>
                            <input type="text" wire:model="details" id="details" class="form-control mt-1" placeholder="i.e. Consultation Service Type">
                            @error('details') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

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

    <!-- Table displaying Patient details -->
    <div class="table-responsive">
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Details</th>
                    <th>Staus</th>
                    <th>Created By</th>
                    @if(Auth::user()->can('discount.type.delete') || Auth::user()->can('discount.type.edit'))

                    <th>Action</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($discount_types as $discount_type)
                <tr>
                    <!-- <td>{{ $loop->iteration }}</td> -->
                    <td>{{ $discount_type->id }}</td>
                    <td>{{ $discount_type->name }}</td>
                    <td>{{ $discount_type->details ?? '' }}</td>
                    <td>{!! $discount_type->is_active == 1 ?
                        '<span class="badge bg-success">Active</span>' : '<span class="badge bg-danger">Inactive</span>' !!}
                    </td>
                    <td>{{ ($discount_type->user) ? $discount_type->user->name : 'Unknown' }}</td>

                    <!-- Action buttons for editing and deleting -->
                    @if(Auth::user()->can('discount.type.delete') || Auth::user()->can('discount.type.edit'))
                    <td>
                        @if(Auth::user()->can('discount.type.edit') )

                        <button wire:click="edit({{ $discount_type->id }})" class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#modal" title="Edit">Edit</button>
                       @endif
                        @if(Auth::user()->can('discount.type.delete') )
                        <button wire:click="delete({{ $discount_type->id }})" class="btn btn-danger btn-sm" title="Delete">Delete</button>
                        @endif
                    </td>
                    @endif
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <!-- Pagination Links -->
    {{ $discount_types->links() }}
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
