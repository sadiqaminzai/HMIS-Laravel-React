<div class="container">
    <div class="row mb-1">
        <div class="col-md-2">
            {{-- <button class="btn btn-outline-primary btn-sm" wire:click="create" data-bs-toggle="modal" data-bs-target="#modal">
                <i class="fas fa-plus-circle"></i> Add Role --}}
            </button>
        </div>
        <div class="col-md-8 text-start">
            <h3>Roles & Permissions</h3>
        </div>
    </div>

    <!-- Modal for Creating or Editing a Role -->
    <div wire:ignore.self class="modal fade" id="modal" tabindex="-1" role="dialog" aria-labelledby="modalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="roleModalLabel">{{ $role_id ? 'Edit Role' : 'Create Role' }}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeModal()"></button>
                </div>
                <div class="modal-body modal-scrollable">
                    <div class="form-group mb-1">
                        <label for="role">Select Role <span class="text-danger">*</span></label>
                        <select id="role" wire:model="selectedRoleId" class="form-control mt-1">
                            <option value="">-- Select Existing Role --</option>
                            @foreach($allRoles as $role)
                                <option value="{{ $role->id }}">{{ $role->name }}</option>
                            @endforeach
                            @if(!$isEdit)
                                <option value="create_new">Create New Role</option>
                            @endif
                        </select>
                        @error('selectedRoleId') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>

                    <div class="form-group mb-1" wire:if="$selectedRoleId === 'create_new'">
                        <label for="name">Role Name <span class="text-danger">*</span></label>
                        <input type="text" wire:model="name" id="name" class="form-control mt-1" placeholder="Enter role name...">
                        @error('name') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>

                    <div class="form-check mb-3">
                        <input type="checkbox" class="form-check-input" id="checkAllPermissions" wire:click="toggleAllPermissions()">
                        <label class="form-check-label" for="checkAllPermissions">
                            Permission ALL
                        </label>
                    </div>
                    <hr class="">

                    <div class="row">
                        @foreach ($getPermisionsGroup as $group)
                            <div class="col-md-4">
                                <div class="form-check mb-2">
                                    <input type="checkbox" class="form-check-input permission-check group-check" id="groupCheck{{ $group->group_name }}" wire:click="toggleGroupPermissions('{{ $group->group_name }}')">
                                    <label class="form-check-label">
                                        {{ $group->group_name }}
                                    </label>
                                </div>
                                @foreach (\Spatie\Permission\Models\Permission::getPermissionsByGroupName($group->group_name) as $permission)
                                    <div class="form-check mb-2 ms-3">
                                        <input type="checkbox" class="form-check-input permission-check" wire:model="permissions" id="permission{{ $permission->id }}" value="{{ $permission->id }}">
                                        <label class="form-check-label" for="permission{{ $permission->id }}">
                                            {{ $permission->name }}
                                        </label>
                                    </div>
                                @endforeach
                            </div>
                        @endforeach
                    </div>
                </div>
                <div class="modal-footer mt-3">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" wire:click="save" class="btn btn-success">
                        {{ $role_id ? 'Update' : 'Save' }}
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Details Modal for Showing Permissions -->
    <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog" aria-labelledby="detailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-scrollable" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title fw-bold text-primary" id="detailsModalLabel">Role Details - {{ $roleDetails->name ?? '' }}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal()"></button>
                </div>
                <div class="modal-body modal-scrollable px-4 py-3">
                    @if($roleDetails)
                        <h6 class="fw-bold text-secondary">Permissions:</h6>
                        <ul class="list-group mt-2">
                            @foreach ($roleDetails->permissions as $permission)
                                <li class="list-group-item d-flex justify-content-between align-items-center">
                                    {{ $permission->name }}
                                    <span class="badge bg-danger text-white">Permission</span>
                                </li>
                            @endforeach
                        </ul>
                    @else
                        <p class="text-muted">No role details available.</p>
                    @endif
                </div>
                <div class="modal-footer mt-3">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    </div>


    <!-- Table displaying Role details -->
    <div class="table-responsive mt-3">
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>S.No</th>
                    <th>Role</th>
                    <th>Permissions</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                @foreach($roles as $key => $role)
                <tr>
                    <td>{{ $roles->firstItem() + $key }}</td>
                    <td>{{ $role->name }}</td>
                    <td>
                        <button wire:click="showDetails({{ $role->id }})" class="btn btn-outline-info btn-sm" data-bs-toggle="modal" data-bs-target="#detailsModal">
                            <i class="fa fa-info-circle"></i> Details
                        </button>
                    </td>
                    <td>
                        <button wire:click="openModal({{ $role->id }})" class="btn btn-outline-warning btn-sm" data-bs-toggle="modal" data-bs-target="#modal" wire:ignore>
                            <i class="fa fa-edit"></i> Edit
                        </button>
                        <button wire:click="delete({{ $role->id }})" class="btn btn-outline-danger btn-sm">
                            <i class="fa fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <!-- Pagination Links -->
    <div class="mt-3">
        {{ $roles->links() }}
    </div>

    <style>
        .modal-scrollable {
            max-height: 450px; /* Adjust height as needed */
            overflow-y: auto;
        }

        /* Custom Scrollbar */
        .modal-scrollable::-webkit-scrollbar {
            width: 10px;
        }

        .modal-scrollable::-webkit-scrollbar-track {
            background: rgb(12, 20, 39);
        }

        .modal-scrollable::-webkit-scrollbar-thumb {
            background: rgb(35, 59, 116);
            border-radius: 4px;
        }

        .modal-scrollable::-webkit-scrollbar-thumb:hover {
            background:rgb(19, 35, 72);
        }
    </style>
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

        window.addEventListener('open-details-modal', () => {
            var modal = new bootstrap.Modal(document.getElementById('detailsModal'));
            modal.show();
        });

        window.addEventListener('close-details-modal', () => {
            var modal = bootstrap.Modal.getInstance(document.getElementById('detailsModal'));
            modal.hide();
        });
    });
    window.addEventListener('save-modal', () => {
        var modal = bootstrap.Modal.getInstance(document.getElementById('modal'));
        modal.hide();
    });
</script>
