<?php

namespace App\Livewire\Roles;

use Livewire\Component;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use Livewire\WithFileUploads;
use Livewire\WithPagination;
use Maatwebsite\Excel\Facades\Excel;
use App\Exports\PermissionsExport;
use App\Imports\PermissionsImport;
use Illuminate\Support\Facades\Storage;

class RolesPermission extends Component
{
    use WithPagination, WithFileUploads;

    public $permission_id, $name, $group_name, $is_active;
    public $isOpen = false;
    public $search = '';
    public $importFile;


    protected $paginationTheme = 'bootstrap';

    public function render()
    {
        $permissions = Permission::where('name', 'like', '%' . $this->search . '%')
            ->orWhere('group_name', 'like', '%' . $this->search . '%')
            ->paginate(10);

        return view('livewire.roles.permission', ['permissions' => $permissions]);
    }

    public function create()
    {
        $this->resetInputFields();
        $this->openModal();
    }

    public function openModal()
    {
        $this->isOpen = true;
        $this->dispatch('open-modal');
    }

    public function closeModal()
    {
        $this->isOpen = false;
        $this->resetInputFields();
        $this->dispatch('close-modal');
    }

    private function resetInputFields()
    {
        $this->permission_id = null;
        $this->name = '';
        $this->group_name = '';
    }

    public function add()
    {
        $this->validate([
            'name' => 'required',
            'group_name' => 'required',
        ]);

        Permission::create([
            'name' => $this->name,
            'group_name' => $this->group_name,
        ]);
        $this->resetInputFields();
        $this->closeModal();
        $this->dispatch('save-modal');

        $this->dispatch('success', message: 'Permission created successfully.');
    }

    public function edit($id)
    {
        $permission = Permission::findOrFail($id);
        $this->permission_id = $permission->id;
        $this->name = $permission->name;
        $this->group_name = $permission->group_name;

        $this->openModal();
    }

    public function update()
    {
        $this->validate([
            'name' => 'required',
            'group_name' => 'required',
        ]);

        $permission = Permission::findOrFail($this->permission_id);

        $permission->update([
            'name' => $this->name,
            'group_name' => $this->group_name,
        ]);
        $this->resetInputFields();

        $this->closeModal();
        $this->dispatch('save-modal');
        $this->dispatch('success', message: 'Permission updated successfully.');
    }

    public function delete($id)
    {
        Permission::findOrFail($id)->delete();
        $this->dispatch('error', message: 'Permission deleted successfully.');
    }
    public function exportPermissions()
    {
        return Excel::download(new PermissionsExport, 'permissions.xlsx');
    }

    public function importPermissions()
    {
        $this->validate([
            'importFile' => 'required|mimes:xlsx,csv',
        ]);

        Excel::import(new PermissionsImport, $this->importFile->getRealPath());

        $this->dispatch('success', message: 'Permissions imported successfully.');
    }
}
