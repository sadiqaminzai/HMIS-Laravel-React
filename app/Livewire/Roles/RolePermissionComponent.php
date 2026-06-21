<?php

namespace App\Livewire\Roles;

use Livewire\Component;
use Livewire\WithPagination;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RolePermissionComponent extends Component
{
    use WithPagination;

    public $role_id, $name, $permissions = [], $allPermissions;
    public $isOpen = false, $isEdit = false;
    public $selectedRoleId; // To store selected role ID
    public $allRoles;
    public $showDetailsModal = false; // To control the details modal visibility
    public $roleDetails; // To store role details for the modal

    protected $paginationTheme = 'bootstrap';

    public function mount()
    {
        $this->allPermissions = Permission::all();
        $this->allRoles = Role::all(); // Retrieve all roles for dropdown
    }

    public function render()
    {
        $roles = Role::with('permissions')->paginate(10);
        $getPermisionsGroup = Permission::select('group_name')->groupBy('group_name')->get();
        return view('livewire.roles.role-permission-component', compact('roles', 'getPermisionsGroup'));
    }

    public function create()
    {
        $this->resetInputFields();
        $this->openModal();
    }

    public function openModal($roleId = null)
    {
        $this->isOpen = true;
        $this->isEdit = $roleId ? true : false;

        if ($roleId) {
            $role = Role::findOrFail($roleId);
            $this->role_id = $role->id;
            $this->name = $role->name;
            $this->permissions = $role->permissions->pluck('id')->toArray();
        } else {
            $this->resetInputFields();
        }
        $this->dispatch('open-modal');
    }

    public function closeModal()
    {
        $this->resetInputFields();
        $this->dispatch('close-modal');
    }

    public function resetInputFields()
    {
        $this->role_id = '';
        $this->name = '';
        $this->permissions = [];
    }

    public function save()
    {
        // Validate the selected role or role name
        $this->validate([
            'selectedRoleId' => $this->isEdit ? 'nullable' : 'required',
            'name' => 'required_if:selectedRoleId,create_new|unique:roles,name,' . $this->role_id,
            'permissions' => 'array',
        ]);

        if ($this->selectedRoleId == 'create_new' || !$this->isEdit) {
            // Create a new role if 'Create New Role' is selected or not editing
            $role = Role::create(['name' => $this->name]);
            $message = 'Role created successfully.';
        } else {
            // Assign permissions to existing role in edit mode
            $role = Role::findOrFail($this->role_id);
            $role->update(['name' => $this->name]);
            $message = 'Role updated successfully.';
        }

        $role->syncPermissions(Permission::whereIn('id', $this->permissions)->pluck('name')->toArray());
        $this->closeModal();

        $this->dispatch('save-modal');
        $this->dispatch('success', message: $message);
    }

    public function delete($roleId)
    {
        Role::findOrFail($roleId)->delete();
        $this->dispatch('error', message:'Role deleted successfully.');

    }

    public function toggleAllPermissions()
    {
        if (count($this->permissions) == $this->allPermissions->count()) {
            $this->permissions = [];
        } else {
            $this->permissions = $this->allPermissions->pluck('id')->toArray();
        }
    }

    public function toggleGroupPermissions($groupName)
    {
        $groupPermissions = Permission::where('group_name', $groupName)->pluck('id')->toArray();
        if (array_intersect($groupPermissions, $this->permissions) == $groupPermissions) {
            $this->permissions = array_diff($this->permissions, $groupPermissions);
        } else {
            $this->permissions = array_unique(array_merge($this->permissions, $groupPermissions));
        }
    }

    public function showDetails($roleId)
    {
        $this->roleDetails = Role::with('permissions')->findOrFail($roleId);
        $this->showDetailsModal = true;
        $this->dispatch('open-details-modal');
    }

    public function closeDetailsModal()
    {
        $this->showDetailsModal = false;
        $this->dispatch('close-details-modal');
    }
}
