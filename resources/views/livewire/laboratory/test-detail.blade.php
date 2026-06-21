<div class="container">
    <div class="row mb-1">
        <div class="col-md-1">
            @if(Auth::user()->can('lab.test.detail.add'))
            <button class="btn btn-outline-primary btn-icon-text btn-sm" wire:click="create" data-bs-toggle="modal" data-bs-target="#modal" wire:ignore>
                <i class="btn-icon-prepend" data-feather="plus-circle"></i>Add
            </button>
            @endif
        </div>
        <div class="col-md-8 text-start">
            <h3>Test Details List</h3s>
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
                    <h5 class="modal-title" id="modalLabel">{{ $id ? 'Edit Test Detail' : 'Create Test Detail' }}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeModal()"></button>
                </div>

                <div class="modal-body">
                    <div class="row">
                        <!-- Test Name Input -->
                        <div class="col-md-6 form-group mb-1">
                            <label for="name">Name <span class="text-danger fw-300"> *</span></label>
                            <input type="text" wire:model="name" id="name" class="form-control mt-1" placeholder="i.e. CBC">
                            @error('name') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>

                        <!-- test_type_Id Input -->
                        <div class="col-md-6 form-group mb-1">
                            <label for="test_type_id">Test Type <span class="text-danger fw-300"> *</span></label>
                            <select wire:model="test_type_id" id="test_type_id" class="form-control mt-1">
                                <option value="" disabled>Select Test Type</option>
                                @foreach($services as $service)
                                <option value="{{ $service->id }}">{{ $service->name }}</option>
                                @endforeach
                            </select>
                            @error('test_type_id') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="row">
                        <!-- Normal Range Input -->
                        <div class="col-md-6 form-group mb-1">
                            <label for="normal_range">Normal Range <span class="text-danger fw-300"> *</span></label>
                            <input type="text" wire:model="normal_range" id="normal_range" class="form-control mt-1" placeholder="i.e. 0-100">
                            @error('normal_range') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>

                        <!-- Unit Input -->
                        <div class="col-md-6 form-group mb-1">
                            <label for="unit">Unit <span class="text-danger fw-300"> *</span></label>
                            <input type="text" wire:model="unit" id="unit" class="form-control mt-1" placeholder="i.e. mg/dL">
                            @error('unit') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="row">
                        <!-- Test Description in haing textarea with col-md-12 Input -->
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
                            <select wire:model.defer="is_active" id="is_active" class="form-control mt-1">
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

    <!-- Table displaying Test details -->
    <div class="table-responsive">
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>Code</th>
                    <th>Name</th>
                    <th>Normal Range</th>
                    <th>Unit</th>
                    <th>Description</th>
                    <th>Test Type</th>
                    <th>Staus</th>
                    <th>Created By</th>

                    @if(Auth::user()->can('lab.test.detail.edit') || Auth::user()->can('lab.test.detail.delete') || Auth::user()->can('lab.test.detail.details'))
                    <th>Action</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($test_details as $test_detail)
                <tr>
                    <!-- <td>{{ $loop->iteration }}</td> -->
                    <td>{{ $test_detail->id }}</td>
                    <td>{{ $test_detail->name }}</td>
                    <td>{{ $test_detail->normal_range ?? '' }}</td>
                    <td>{{ $test_detail->unit ?? '' }}</td>
                    <td>{{ Str::limit($test_detail->description, 25) ?? '' }}</td>
                    <td>{{ ($test_detail->service) ? $test_detail->service->name : 'Unknown' }}</td>
                    <td>{!! $test_detail->is_active == 1 ?
                        '<span class="badge bg-success">Active</span>' : '<span class="badge bg-danger">Inactive</span>' !!}
                    </td>
                    <td>{{ ($test_detail->user) ? $test_detail->user->name : 'Unknown' }}</td>

                    <!-- Action buttons for editing and deleting -->
                    @if(Auth::user()->can('lab.test.detail.edit') || Auth::user()->can('lab.test.detail.delete') || Auth::user()->can('lab.test.detail.details'))
                    <td>
                        @if(Auth::user()->can('lab.test.detail.edit'))
                        <button wire:click="edit({{ $test_detail->id }})" class="btn btn-outline-primary btn-icon-text btn-sm" data-bs-toggle="modal" data-bs-target="#modal" title="Edit">
                            <i class="btn-icon-prepend" data-feather="edit"></i>Edit
                        </button>
                        @endif
                        @if(Auth::user()->can('lab.test.detail.delete'))
                        <button wire:click="delete({{ $test_detail->id }})" class="btn btn-outline-danger btn-icon-text btn-sm" title="Delete">
                            <i class="btn-icon-prepend" data-feather="trash-2"></i>Delete
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
    @if(!$search)
    <div class="d-flex justify-content-end">
        {{ $test_details->links('pagination::bootstrap-4') }}
    </div>
    @endif
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
