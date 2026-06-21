<?php

namespace App\Livewire\Roles;

use Livewire\Component;
use Livewire\WithPagination;
use Livewire\WithFileUploads;
use Spatie\Permission\Models\Role;
use Maatwebsite\Excel\Facades\Excel;
use App\Imports\RolesImport;
use App\Exports\RolesExport;

class Roles extends Component
{
    use WithPagination, WithFileUploads;

    public $role_id, $name;
    public $isOpen = false;
    public $search = '';
    public $importFile;

    protected $paginationTheme = 'bootstrap';

    public function render()
    {
        $roles = Role::where('name', 'like', '%' . $this->search . '%')->paginate(10);
        return view('livewire.roles.roles', ['roles' => $roles]);
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
        $this->role_id = null;
        $this->name = '';
    }

    public function add()
    {
        $this->validate([
            'name' => 'required|unique:roles,name',
        ]);

        Role::create(['name' => $this->name]);

        $this->resetInputFields();
        $this->closeModal();
        $this->dispatch('save-modal');
        $this->dispatch('success', message: 'Role created successfully.');
    }

    public function edit($id)
    {
        $role = Role::findOrFail($id);
        $this->role_id = $role->id;
        $this->name = $role->name;

        $this->openModal();
    }

    public function update()
    {
        $this->validate([
            'name' => 'required|unique:roles,name,' . $this->role_id,
        ]);

        $role = Role::findOrFail($this->role_id);
        $role->update(['name' => $this->name]);

        $this->resetInputFields();
        $this->closeModal();
        $this->dispatch('save-modal');
         $this->dispatch('success', message: 'Role updated successfully.');
    }

    public function delete($id)
    {
        Role::findOrFail($id)->delete();
        $this->dispatch('error', message: 'Role deleted successfully.');
    }

    public function exportRoles()
    {
        return Excel::download(new RolesExport, 'roles.xlsx');
    }

    public function importRoles()
    {
        $this->validate([
            'importFile' => 'required|mimes:xlsx,csv',
        ]);

        Excel::import(new RolesImport, $this->importFile->getRealPath());

        $this->dispatch('success', message: 'Roles imported successfully.');
    }
}
