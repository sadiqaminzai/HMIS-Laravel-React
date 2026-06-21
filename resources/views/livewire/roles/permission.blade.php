<div class="container">
    <div class="row mb-1">
        <div class="col-md-2">
            <button class="btn btn-outline-primary btn-sm" wire:click="create" data-bs-toggle="modal" data-bs-target="#modal" wire:ignore>
                <i class="fas fa-plus-circle"></i> Add Permission
            </button>
        </div>
        <div class="col-md-2">
            <button class="btn btn-outline-success btn-sm" wire:click="exportPermissions">
                <i class="fas fa-download"></i> Export Permissions
            </button>
        </div>
        <div class="col-md-4">
            <div class="input-group">
                <input type="file" wire:model="importFile" class="form-control form-control-sm">
                <button type="button" wire:click="importPermissions" class="btn btn-outline-info btn-sm">
                    <i class="fas fa-upload"></i> Import Permissions
                </button>
            </div>
            @error('importFile') <span class="text-danger">{{ $message }}</span> @enderror
        </div>
        <div class="col-md-3 offset-md-1">
            <input type="text" wire:model.live="search" class="form-control form-control-sm" placeholder="Search here...">
        </div>
    </div>

    <!-- Modal for Creating or Editing a Permission -->
    <div wire:ignore.self class="modal fade" id="modal" tabindex="-1" role="dialog" aria-labelledby="modalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalLabel">{{ $permission_id ? 'Edit Permission' : 'Create Permission' }}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeModal()"></button>
                </div>
                <div class="modal-body">
                    <div class="form-group mb-1">
                        <label for="name">Name <span class="text-danger">*</span></label>
                        <input type="text" wire:model="name" id="name" class="form-control mt-1" placeholder="Enter name...">
                        @error('name') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>

                    <div class="form-group mb-1">
                        <label for="group_name">Group Name <span class="text-danger">*</span></label>
                        <select wire:model="group_name" id="group_name" class="form-control mt-1">
                            <option value="" disabled>Select Group</option>
                            <option value="users_management">Users Management</option>
                            <option value="general_setup">General Setup</option>
                            <option value="manage_employee">Manage Employee</option>
                            <option value="manage_customer">Manage Customer</option>
                            <option value="roles_permissions">Roles & Permissions</option>
                            <option value="reports">Reports</option>
                            <option value="system_setting">System Setting</option>
                        </select>
                        @error('group_name') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>
                </div>
                <div class="modal-footer mt-3">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" wire:click="{{ $permission_id ? 'update' : 'add' }}" class="btn btn-success">
                        {{ $permission_id ? 'Update' : 'Save' }}
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Table displaying Permission details -->
    <div class="table-responsive mt-3">
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>S.No</th>
                    <th>Name</th>
                    <th>Group Name</th>
                    <th>Action</th>
                </tr>
            </thead>
            <tbody>
                @foreach($permissions as $key => $permission)
                <tr>
                    <td>{{ $key + 1 }}</td>
                    <td>{{ $permission->name }}</td>
                    <td>{{ $permission->group_name }}</td>
                    <td>
                        <button wire:click="edit({{ $permission->id }})" class="btn btn-outline-warning btn-sm" data-bs-toggle="modal" data-bs-target="#modal" wire:ignore>
                            <i class="fa fa-edit"></i> Edit
                        </button>
                        <button wire:click="delete({{ $permission->id }})" class="btn btn-outline-danger btn-sm">
                            <i class="fa fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <!-- Pagination Links -->
    {{ $permissions->links() }}
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
