<?php

namespace App\Livewire;

use Livewire\Component;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Livewire\WithFileUploads;
use Livewire\WithPagination;
use Maatwebsite\Excel\Row;
use PharIo\Manifest\Author;
use Spatie\Permission\Models\Role;

class UserManagement extends Component
{
    use WithFileUploads, WithPagination;


    public $id, $name, $username,$email, $password,$photo,$phone, $address, $role_id,$status;

    public $search = ''; // Add a search variable
    public $isOpen = 0;
    public $selectedUser;


    protected $paginationTheme = 'bootstrap'; // To use Bootstrap for pagination
    // want to debug the inputs

    public function showDetails($id)
    {
        $this->selectedUser = User::findOrFail($id);
        $this->dispatch('open-modal', 'detailsModal');
    }

    public function closeDetailsModal()
    {
        $this->selectedUser = null;
        $this->dispatch('close-modal', 'detailsModal');
    }
    public function updatingSearch()
    {
        $this->resetPage(); // Reset pagination when search query is updated
    }

    public function render()
    {
        // Add a search filter for all fields in users
        $users = User::query()
            ->where('name', 'like', '%' . $this->search . '%')
            ->orWhere('username', 'like', '%' . $this->search . '%')
            ->orWhere('email', 'like', '%' . $this->search . '%')
            ->orWhere('phone', 'like', '%' . $this->search . '%')
            ->orWhere('address', 'like', '%' . $this->search . '%')
            ->orWhere('role', 'like', '%' . $this->search . '%')
            ->orWhere('status', 'like', '%' . $this->search . '%')
            ->paginate(10); // Paginate results (adjust as needed)
            $roles = Role::all(); // Fetch all roles to use in the dropdown


            return view('livewire.user-management', ['users' => $users, 'roles' => $roles]);
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
        $this->resetInputFields();
        $this->dispatch('close-modal');
    }

    private function resetInputFields()
    {
        $this->id = '';
        $this->name = '';
        $this->username = '';
        $this->email = '';
        $this->password = '';
        $this->photo = '';
        $this->phone = '';
        $this->address = '';
        $this->role_id = '';
        $this->status = 'active';


    }

    public function add()
    {

       //DDING ALL TEH FIELDS

        $this->validate([
            'name' => 'required',
            'username' => 'required',
            'email' => 'required|email|unique:users',
            'phone' => 'required',
            'role_id' => 'required',
            'status' => 'required',


        ]);


        if ($this->photo) {
            $imagePath = $this->photo->store('users', 'public');
        }


        $user = User::create([
            'name' => $this->name,
            'username' => $this->username,
            'email' => $this->email,
            'password' => bcrypt('123456'),
            'phone' => $this->phone,
            'role' =>'admin',
            'address' => $this->address,
            'status' => $this->status,
            'photo' => $imagePath ?? null,
        ]);
        $role = Role::find($this->role_id);
        $user->assignRole($role);

        $this->resetInputFields();
        $this->dispatch('close-modal');
        $this->dispatch('save-modal');
        $this->dispatch('success', message: 'Record created successfully.');
    }

    public function update()
    {
        $this->validate([
            'name' => 'required',
            'username' => 'required',
            'email' => 'required',
            'phone' => 'required',
            'role_id' => 'required',
            'status' => 'required',
        ]);

        $data = User::findOrFail($this->id);
        if ($this->photo) {
            $imagePath = $this->photo->store('users', 'public');
        }
        $data->update([
            'name' => $this->name,
            'username' => $this->username,
            'email' => $this->email,
            'phone' => $this->phone,
            'address' => $this->address,
            'status' => $this->status,
            'role' =>'admin',
            'photo' => $imagePath ?? $data->photo,
        ]);
        // if password is not empty, update password
        if ($this->password) {
            $data->update([
                'password' => bcrypt($this->password),
            ]);
        }
        $role = Role::find($this->role_id);
        $data->syncRoles([$role]);

        $this->resetInputFields();
        $this->dispatch('close-modal');
        $this->dispatch('save-modal');
        $this->dispatch('success', message: 'Record updated successfully.');
    }

    public function edit($id)
    {
        $data = User::findOrFail($id);
        $this->id = $data->id;
        $this->name = $data->name;
        $this->username = $data->username;
        $this->email = $data->email;
        $this->phone = $data->phone;
        $this->address = $data->address;
        $this->status = $data->status;
        $this->photo = $data->photo;
        $this->role_id = $data->roles->first()->id ?? null;


        $this->openModal();
    }

    public function delete($id)
    {
        $data = User::findOrFail($id);
        $data->delete();
        $this->dispatch('error', message: 'Record marked as deleted successfully.');
    }



}
