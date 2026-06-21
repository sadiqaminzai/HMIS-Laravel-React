<div class="container">

    <div class="row mb-2">
        @if(Auth::user()->can('user.add'))
        <div class="col-md-6">
            <button wire:click="create" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#modal">Add User</button>
        </div>
        @endif
        <div class="col-md-3"></div>
        <div class="col-md-3">
            <input type="text" wire:model.live="search" class="form-control" placeholder="Search here...">
        </div>
    </div>
    <!-- Bootstrap Modal for creating or editing a User -->
    <div wire:ignore.self class="modal fade" id="modal" tabindex="-1" role="dialog" aria-labelledby="modalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalLabel">{{ ($id) ? 'Edit User' : 'Create User' }}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeModal()"></button>
                </div>
                <div class="modal-body">
                    <!-- Name and Username Input Fields -->
                    <div class="row">
                        <div class="col-md-6 mb-1">
                            <label for="name">Name</label>
                            <input type="text" wire:model="name" id="name" class="form-control mt-1" placeholder="Enter name...">
                            @error('name') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                        <div class="col-md-6 mb-1">
                            <label for="username">Username</label>
                            <input type="text" wire:model="username" id="username" class="form-control mt-1" placeholder="Enter username...">
                            @error('username') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <!-- Email and Phone Input Fields -->
                    <div class="row">
                        <div class="col-md-6 mb-1">
                            <label for="email">Email</label>
                            <input type="email" wire:model="email" id="email" class="form-control mt-1" placeholder="Enter email...">
                            @error('email') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                        <div class="col-md-6 mb-1">
                            <label for="phone">Phone</label>
                            <input type="text" wire:model="phone" id="phone" class="form-control mt-1" placeholder="Enter phone number...">
                            @error('phone') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <!-- Address and Role Input Fields -->
                    <div class="row">
                        <div class="col-md-6 mb-1">
                            <label for="address">Address</label>
                            <input type="text" wire:model="address" id="address" class="form-control mt-1" placeholder="Enter address...">
                            @error('address') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                        <div class="col-md-6 mb-1">
                            <label for="role">Role</label>
                            <select wire:model="role_id" id="role" class="form-control mt-1">
                                <option value="">Select Role</option>
                                @foreach($roles as $role)
                                    <option value="{{ $role->id }}">{{ ucfirst($role->name) }}</option>
                                @endforeach
                            </select>
                            @error('role_id') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>

                    </div>

                    <!-- Status and Photo Upload Input Fields -->
                    <div class="row">
                        <div class="col-md-6 mb-1">
                            <label for="status">Status</label>
                            <select wire:model="status" id="status" class="form-control mt-1">
                                <option value="active">Active</option>
                                <option value="inactive">Inactive</option>
                            </select>
                            @error('status') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                        <div class="col-md-6 mb-1">
                            <label for="photo">Photo</label>
                            <input type="file" wire:model="photo" id="photo" class="form-control mt-1">
                            @error('photo') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <!-- Show Password field only when updating user -->
                    @if($id)
                    <div class="row">
                        <div class="col-md-12 my-1">
                            <label for="password">Password</label>
                            <input type="password" wire:model="password" id="password" class="form-control mt-1" placeholder="Enter password...">
                            <!-- insert a small text in red to show enter password if you want to update it otherwise leave it blank -->
                            <small class="text-danger">Enter password if you want to update it</small>
                            @error('password') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>
                    @endif

                </div>

                <div class="modal-footer mt-3">
                    <!-- Cancel Button -->
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <!-- Save/Update Button -->
                    <button type="button" wire:click="{{ $id ? 'update' : 'add' }}" class="btn btn-success">
                        {{ ($id) ? 'Update' : 'Save' }}
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Table displaying User details -->
    <div class="table-responsive">
        <table class="table table-bordered mt-5">
            <thead>
                <tr>
                    <th>S.No</th>
                    <th>Name</th>
                    <th>Role</th>
                    <th>Email</th>
                    @if(Auth::user()->can('user.delete') || Auth::user()->can('user.edit') ||Auth::user()->can('user.details') )

                    <th>Action</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($users as $user)
                <tr>
                    <td>{{ $loop->iteration }}</td>
                    <td>{{ $user->name }}</td>
                    <td>
                            @if($user->roles && $user->roles->isNotEmpty())
                            {{ ucfirst($user->roles->first()->name) }}
                        @else
                            No Role Assigned
                        @endif
                    </td>
                     <td>{{ $user->email }}</td>
                    @if(Auth::user()->can('user.delete') || Auth::user()->can('user.edit')|| Auth::user()->can('user.details'))
                    <td>
                         @if(Auth::user()->can('user.details'))
                        <button wire:click="showDetails({{ $user->id }})" class="btn btn-info btn-sm" data-bs-toggle="modal" data-bs-target="#detailsModal">
                            Details
                        </button>
                        @endif
                        @if(Auth::user()->can('user.edit'))
                        <button wire:click="edit({{ $user->id }})" class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#modal" title="Edit">Edit</button>
                        @endif
                        @if(Auth::user()->can('user.delete'))
                        <button wire:click="delete({{ $user->id }})" class="btn btn-danger btn-sm" title="Delete">Delete</button>
                        @endif
                    </td>
                    @endif
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>

    <!-- Pagination Links -->
    {{ $users->links() }}

    <!-- Details Modal -->
    <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog" aria-labelledby="detailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <!-- Header -->
                <div class="modal-header  text-white">
                    <h5 class="modal-title" id="detailsModalLabel">User Details</h5>
                    <button type="button" class="btn-close text-white" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
                </div>

                <!-- Body -->
                <div class="modal-body p-2">
                    <!-- Centered User Photo -->
                    <div class="text-center mb-2">
                        @if($selectedUser?->photo)
                            <img src="{{ asset('storage/' . $selectedUser->photo) }}" class="rounded-circle border border-3 border-primary" width="90" height="90" alt="User Photo">
                        @endif
                    </div>

                    <!-- User Information in Two-Column Grid -->
                    <div class="row g-3">
                        <div class="col-md-6">
                            <div class=" p-3 rounded border">
                                <strong>Name:</strong> {{ $selectedUser?->name }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class=" p-3 rounded border">
                                <strong>Username:</strong> {{ $selectedUser?->username }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class=" p-3 rounded border">
                                <strong>Email:</strong> {{ $selectedUser?->email }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class=" p-3 rounded border">
                                <strong>Phone:</strong> {{ $selectedUser?->phone }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class=" p-3 rounded border">
                                <strong>Address:</strong> {{ $selectedUser?->address }}
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class=" p-3 rounded border">
                                <strong>Role:</strong>
                                @if($selectedUser && $selectedUser->roles->isNotEmpty())
                                    {{ ucfirst($selectedUser->roles->first()->name) }}
                                @else
                                    No Role Assigned
                                @endif

                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class=" p-3 rounded border">
                                <strong>Status:</strong> {{ ucfirst($selectedUser?->status) }}
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
