<div class="container">
    <div class="row mb-1">
        @if(Auth::user()->can('pharmacy.stock.add') )

        <div class="col-md-1">
            <button class="btn btn-outline-primary btn-icon-text btn-sm" wire:click="create" data-bs-toggle="modal" data-bs-target="#modal" wire:ignore>
                <i class="btn-icon-prepend" data-feather="plus-circle"></i>Add
            </button>
        </div>
        @endif
        <div class="col-md-8 text-start">
            <h3>Stock List</h3s>
        </div>
        <div class="col-md-3">
            <input type="text" wire:model.live="search" class="form-control" placeholder="Search here...">
        </div>
    </div>

    <div wire:ignore.self class="modal fade" id="modal" tabindex="-1" role="dialog" aria-labelledby="modalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">

                <div class="modal-header">
                    <h5 class="modal-title" id="modalLabel">{{ $id ? 'Edit Stock' : 'Create Stock' }}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeModal()"></button>
                </div>

                <div class="modal-body">
                    <div class="row">
                        <div class="col-md-12">
                            <div class="form-group mb-1">
                                <label for="product_id">Product Name <span class="text-danger">*</span></label>
                                <select wire:model="product_id" id="product_id" class="form-control mt-1" wire:change="fetchProductDetails">
                                    <option value="" disabled>Select Product</option>
                                    @foreach($products as $product)
                                    <option value="{{ $product->id }}">{{ strtoupper($product->name) }}</option>
                                    @endforeach
                                </select>
                                @error('product_id') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group mb-1">
                                <label for="batch_no">Batch No <span class="text-danger">*</span></label>
                                <input wire:model="batch_no" type="text" class="form-control mt-1" id="batch_no" placeholder="Enter Batch No">
                                @error('batch_no') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group mb-1">
                                <label for="quantity">Quantity <span class="text-danger">*</span></label>
                                <input
                                    wire:model="quantity"
                                    wire:blur="calculateAmount"
                                    type="number"
                                    class="form-control mt-1"
                                    id="quantity"
                                    placeholder="Enter Quantity">
                                @error('quantity') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                    </div>

                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group mb-1">
                                <label for="mfg_date">Manufacturing Date <span class="text-danger">*</span></label>
                                <input wire:model="mfg_date" type="date" class="form-control mt-1" id="mfg_date" placeholder="Enter Manufacturing Date">
                                @error('mfg_date') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group mb-1">
                                <label for="expiry_date">Expiry Date <span class="text-danger">*</span></label>
                                <input wire:model="expiry_date" type="date" class="form-control mt-1" id="expiry_date" placeholder="Enter Expiry Date">
                                @error('expiry_date') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                    </div>

                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group mb-1">
                                <label for="unit_price">Unit Price <span class="text-danger">*</span></label>
                                <input wire:model.defer="unit_price" wire:blur="calculateAmount" type="number" step="0.01" class="form-control mt-1" id="unit_price" placeholder="Unit Price">
                                @error('unit_price') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="form-group mb-1">
                                <label for="amount">Amount <span class="text-danger">*</span></label>
                                <input wire:model="amount" type="number" step="0.01" class="form-control mt-1" id="amount" placeholder="Enter Amount..." disabled>
                                @error('amount') <span class="text-danger">{{ $message }}</span> @enderror
                            </div>
                        </div>
                    </div>

                    <div class="row">
                        <div class="col-md-6">
                            <div class="form-group mb-1">
                                @if($id)
                                <label for="created_by">Created By</label>
                                <input type="text" class="form-control mt-1" id="created_by" value="{{ Auth::user()->name }}" disabled>
                                @endif
                            </div>
                        </div>
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

    <!-- Table displaying Stock details -->
    <div class="table-responsive">
        <table class="table table-bordered">
            <thead>
                <tr>
                    <!-- <th>S.No</th> -->
                    <th>Code</th>
                    <th>Name</th>
                    <th>Batch No</th>
                    <th>Quantity</th>
                    <th>Bonus</th>
                    <th>Unit Price</th>
                    @if(Auth::user()->can('pharmacy.stock.edit') || Auth::user()->can('pharmacy.stock.delete')|| Auth::user()->can('pharmacy.stock.details'))

                    <th>Action</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($stocks as $stock)
                <tr>
                    <td>{{ $stock->product->id }}</td>
                    <td>{{ StrtoUpper($stock->product->name) }}</td>
                    <td>{{ $stock->batch_no }}</td>
                    <td>{{ $stock->quantity }}</td>
                    <td>{{ $stock->bonus }}</td>
                    <td>{{ $stock->unit_price }}</td>
                    @if(Auth::user()->can('pharmacy.stock.edit') || Auth::user()->can('pharmacy.stock.delete')|| Auth::user()->can('pharmacy.stock.details'))

                    <td>
                        @if(Auth::user()->can('pharmacy.stock.edit') )
                        <button wire:click="showDetails({{ $stock->id }})" class="btn btn-outline-info btn-icon-text btn-sm" data-bs-toggle="modal" data-bs-target="#detailsModal" wire:ignore>
                            <i class="btn-icon-prepend" data-feather="eye"></i>Details
                        </button>
                        @endif

                        @if(Auth::user()->can('pharmacy.stock.delete') )
                        <button wire:click="edit({{ $stock->id }})" class="btn btn-outline-warning btn-icon-text btn-sm" data-bs-toggle="modal" data-bs-target="#modal" title="Edit" wire:ignore>
                            <i class="btn-icon-prepend" data-feather="edit"></i>Edit
                        </button>
                        @endif

                        @if(Auth::user()->can('pharmacy.stock.details') )
                        <button wire:click="delete({{ $stock->id }})" class="btn btn-outline-danger btn-icon-text btn-sm" title="Delete" wire:ignore>
                            <i class="btn-icon-prepend" data-feather="trash"></i>Delete
                        </button>
                        @endif
                    </td>
                    @endif
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <!-- Details Modal -->
    <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog" aria-labelledby="detailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <!-- Header -->
                <div class="modal-header text-white">
                    <h5 class="modal-title" id="detailsModalLabel">{{ StrtoUpper($selectedStock?->product->name) }}</h5>
                    <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
                </div>

                <!-- Body -->
                <div class="modal-body p-2">
                    <!-- Stock Information in Two-Column Grid -->
                    <div class="row g-3">
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Stock Quantity:</strong> {{ $selectedStock?->quantity }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Unit Price:</strong> {{ $selectedStock?->unit_price ?? 'N/A' }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Product ID:</strong> {{ $selectedStock?->product->id }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Batch No:</strong> {{ $selectedStock?->batch_no }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Manufacturing Date:</strong> {{ $selectedStock?->mfg_date ? date('d-m-Y', strtotime($selectedStock->mfg_date)) : 'N/A' }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Expiry Date:</strong> {{ $selectedStock?->expiry_date ? date('d-m-Y', strtotime($selectedStock->expiry_date)) : 'N/A' }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Amount:</strong> {{ $selectedStock?->amount ?? 'N/A' }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Created By:</strong> {{ $selectedStock?->user?->name ?? 'Unknown' }}
                            </div>
                        </div>
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
    });
</script>