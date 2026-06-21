<div class="container">
    <div class="row mb-1">
        @if(Auth::user()->can('pharmacy.product.add'))

        <div class="col-md-1">
            <button class="btn btn-outline-primary btn-icon-text btn-sm" wire:click="create" data-bs-toggle="modal" data-bs-target="#modal" wire:ignore>
                <i class="btn-icon-prepend" data-feather="plus-circle"></i>Add
            </button>
        </div>
        @endif
        <div class="col-md-8 text-start">
            <h3>Products List</h3s>
        </div>
        <div class="col-md-3">
            <input type="text" wire:model.live="search" class="form-control" placeholder="Search here...">
        </div>
    </div>

    <!-- Bootstrap Modal for creating or editing a Packing -->
    <div wire:ignore.self class="modal fade" id="modal" tabindex="-1" role="dialog" aria-labelledby="modalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalLabel">{{ $id ? 'Edit Product' : 'Create Product' }}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeModal()"></button>
                </div>
                <div class="modal-body">
                    <!-- Product Name Input -->
                    <div class="form-group mb-1">
                        <label for="name">Name</label>
                        <input type="text" wire:model="name" id="name" class="form-control mt-1" placeholder="Enter name...">
                        @error('name') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>

                    <div class="form-group mb-1">
                        <label for="cost_price">Cost Price</label>
                        <input type="text" wire:model="cost_price" id="cost_price" class="form-control mt-1" placeholder="Enter cost price...">
                        @error('cost_price') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>

                    <div class="form-group mb-1">
                        <label for="sale_price">Sale Price</label>
                        <input type="text" wire:model="sale_price" id="sale_price" class="form-control mt-1" placeholder="Enter sale price...">
                        @error('sale_price') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>

                    <div class="form-group mb-1">
                        <label for="packing_id">Packing</label>
                        <select wire:model="packing_id" id="packing_id" class="form-control mt-1">
                            <option value="">Select Product</option>
                            @foreach($packings as $packing)
                            <option value="{{ $packing->id }}">{{ $packing->name }}</option>
                            @endforeach
                        </select>
                        @error('packing_id') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>

                    <div class="form-group mb-1">
                        <label for="company_id">Company</label>
                        <select wire:model="company_id" id="company_id" class="form-control mt-1">
                            <option value="">Select Company</option>
                            @foreach($companies as $company)
                            <option value="{{ $company->id }}">{{ $company->name }}</option>
                            @endforeach
                        </select>
                        @error('company_id') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>

                    <div class="form-group mb-1">
                        <label for="location">Location</label>
                        <input type="text" wire:model="location" id="location" class="form-control mt-1" placeholder="Enter location...">
                        @error('location') <span class="text-danger">{{ $message }}</span> @enderror
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

    <!-- Table displaying Product details -->
    <div class="table-responsive">
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>S.No</th>
                    <th>Name</th>
                    <th>Cost Price</th>
                    <th>Sale Price</th>
                    <th>Packing</th>
                    <th>Company</th>
                    <th>Location</th>
                    <th>Staus</th>
                    <th>Created By</th>
                    @if(Auth::user()->can('pharmacy.product.edit') || Auth::user()->can('pharmacy.product.delete'))

                    <th>Action</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($products as $product)
                <tr>
                    <td>
                        <!-- Display S.No start from 1 -->
                        {{ $loop->iteration }}
                    </td>
                    <!-- Display Product name -->
                    <td>{{ $product->name ?? null }}</td>

                    <!-- cost_price, sale_price, Product_id, company_id, location, -->
                    <td>{{ $product->cost_price ?? null }}</td>
                    <td>{{ $product->sale_price ?? null }}</td>
                    <td>{{ $product->packing->name ?? null }}</td>
                    <td>{{ $product->company->name ?? null }}</td>
                    <td>{{ $product->location ?? null }}</td>

                    <!-- Status if is_active = 1 means active else inactive -->
                    <td>
                        {!! $product->is_active == 1 ?
                        '<span class="badge bg-success">Active</span>' :
                        '<span class="badge bg-danger">Inactive</span>' !!}
                    </td>

                    <!-- Display Product creator's name -->
                    <td>{{ ($product->user) ? $product->user->name : 'Unknown' }}</td>

                    <!-- Action buttons for editing and deleting -->
                    @if(Auth::user()->can('pharmacy.product.edit') || Auth::user()->can('pharmacy.product.delete'))

                    <td>
                        @if(Auth::user()->can('pharmacy.product.edit'))

                        <button wire:click="edit({{ $product->id }})" class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#modal" title="Edit">Edit</button>
                        @endif

                        @if(Auth::user()->can('pharmacy.product.delete'))

                        <button wire:click="delete({{ $product->id }})" class="btn btn-danger btn-sm" title="Delete">Delete</button>
                         @endif
                    </td>
                    @endif
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <!-- Pagination Links -->
    {{ $products->links() }}
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
