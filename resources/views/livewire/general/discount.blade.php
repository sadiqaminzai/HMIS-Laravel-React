<div class="container">
    <div class="row mb-1">
    @if(Auth::user()->can('discount.add') )
        <div class="col-md-1">
            <button class="btn btn-outline-primary btn-icon-text btn-sm" wire:click="create" data-bs-toggle="modal" data-bs-target="#modal" wire:ignore>
                <i class="btn-icon-prepend" data-feather="plus-circle"></i>Add
            </button>
        </div>
    @endif
        <div class="col-md-8 text-start">
            <h3>Discount List</h3s>
        </div>
        <div class="col-md-3">
            <input type="text" wire:model.live="search" class="form-control" placeholder="Search here...">
        </div>
    </div>

    <!-- Bootstrap Modal for creating or editing -->
    <div wire:ignore.self class="modal fade" id="modal" tabindex="-1" role="dialog" aria-labelledby="modalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document"> <!-- Added modal-lg class for larger width -->
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalLabel">{{ $id ? 'Edit Discount' : 'Create Discount' }}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeModal()"></button>
                </div>

                <div class="modal-body">
                    <div class="row">
                        <!-- discount Name Input -->
                        <div class="col-md-6 form-group mb-1">
                            <label for="name">Name <span class="text-danger fw-300"> *</span></label>
                            <input type="text" wire:model="name" id="name" class="form-control mt-1" placeholder="i.e. CBC">
                            @error('name') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>

                        <!-- discount_Type_Id Input -->
                        <div class="col-md-6 form-group mb-1">
                            <label for="discount_type_id">Discount Type <span class="text-danger fw-300"> *</span></label>
                            <select wire:model="discount_type_id" id="discount_type_id" class="form-control mt-1">
                                <option value="" disabled>Select Discount Type</option>
                                @foreach($discount_types as $discount_type)
                                <option value="{{ $discount_type->id }}">{{ $discount_type->name }}</option>
                                @endforeach
                            </select>
                            @error('discount_type_id') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="row">
                        <!-- discount Amount Input -->
                        <div class="col-md-6 form-group mb-1">
                            <label for="amount">Amount <span class="text-danger fw-300"> *</span></label>
                            <input type="text" wire:model="amount" id="amount" class="form-control mt-1" placeholder="i.e. 180">
                            @error('amount') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>

                        <!-- discount Currency Input -->
                        <div class="col-md-6 form-group mb-1">
                            <label for="currency">Currency</label>
                            <input type="text" wire:model="currency" id="currency" class="form-control mt-1" placeholder="i.e. AFN">
                            @error('currency') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="row">
                        <!-- discount Description in haing textarea with col-md-12 Input -->
                        <div class="col-md-12 form-group mb-1">
                            <label for="description">Description</label>
                            <textarea wire:model="description" id="description" class="form-control mt-1" placeholder="i.e. This is a test description" rows="3"></textarea>
                            @error('description') <span class="text-danger">{{ $message }}</span> @enderror
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

    <!-- Table displaying discount details -->
    <div class="table-responsive">
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Amount</th>
                    <th>Currency</th>
                    <th>Description</th>
                    <th>Discount Type</th>
                    <th>Staus</th>
                    <th>Created By</th>
                    @if(Auth::user()->can('discount.delete') || Auth::user()->can('discount.edit'))

                    <th>Action</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($discounts as $discount)
                <tr>
                    <!-- <td>{{ $loop->iteration }}</td> -->
                    <td>{{ $discount->id }}</td>
                    <td>{{ $discount->name }}</td>
                    <td>{{ $discount->amount }}</td>
                    <td>{{ $discount->currency ?? '' }}</td>
                    <td>{{ Str::limit($discount->description, 25) ?? '' }}</td>
                    <td>{{ ($discount->discount_type) ? $discount->discount_type->name : 'Unknown' }}</td>

                    <td>{!! $discount->is_active == 1 ?
                        '<span class="badge bg-success">Active</span>' : '<span class="badge bg-danger">Inactive</span>' !!}
                    </td>
                    <td>{{ ($discount->user) ? $discount->user->name : 'Unknown' }}</td>

                    <!-- Action buttons for editing and deleting -->
                    @if(Auth::user()->can('discount.delete') || Auth::user()->can('discount.edit'))

                    <td>
                        @if(Auth::user()->can('discount.edit') )

                        <button wire:click="edit({{ $discount->id }})" class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#modal" title="Edit">Edit</button>
                        @endif
                        @if(Auth::user()->can('discount.delete') )

                        <button wire:click="delete({{ $discount->id }})" class="btn btn-danger btn-sm" title="Delete">Delete</button>
                        @endif
                    </td>
                    @endif
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <!-- Pagination Links -->
    {{ $discounts->links() }}
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
