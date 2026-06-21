<?php

namespace App\Livewire\General;

use App\Models\General\Department;
use App\Models\General\Designation;
use App\Models\General\Employee as GeneralEmployee;
use App\Models\User;
use Livewire\Component;
use Illuminate\Support\Facades\Auth;
use Livewire\WithFileUploads;
use Livewire\WithPagination;


class Employee extends Component
{
    use WithPagination, WithFileUploads;

    public $id, $first_name, $last_name, $employee_code, $department_id, $designation_id, $specialty, $experience_years, $email, $phone_number, $address, $hire_date, $created_by, $updated_by, $deleted_by, $is_active, $is_delete;
    public $search = '';
    public $isOpen = 0;
    protected $paginationTheme = 'bootstrap';
    public $selectedEmployee;

    public function showDetails($id)
    {
        $this->selectedEmployee = GeneralEmployee::with(['Department', 'Designation', 'Created_By', 'Updated_By', 'Deleted_By'])->findOrFail($id);
        $this->dispatch('open-modal', 'detailsModal');
    }

    public function closeDetailsModal()
    {
        $this->selectedEmployee = null;
        $this->dispatch('close-modal', 'detailsModal');
    }

    public function updatingSearch()
    {
        $this->resetPage();
    }

    public function render()
    {
        $departments = Department::get();
        $disgnations = Designation::get();

        $employees = GeneralEmployee::with(['Department', 'Designation', 'Created_By', 'Updated_By', 'Deleted_By'])
            ->where('is_delete', 0)
            ->where(function ($query) {
                $query->where('first_name', 'like', '%' . $this->search . '%')
                      ->orWhereHas('Created_By', function ($query) {
                          $query->where('name', 'like', '%' . $this->search . '%');
                      });
            })
            ->paginate(10);

        return view('livewire.general.employee', ['employees' => $employees, 'departments' => $departments, 'disgnations' => $disgnations]);
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
        $this->first_name = '';
        $this->last_name = '';
        $this->department_id = '';
        $this->designation_id = '';
        $this->specialty = '';
        $this->experience_years = '';
        $this->phone_number = '';
        $this->address = '';
        $this->email = '';
        $this->is_active = 1;
    }

    public function add()
    {
        $this->validate([
            'first_name' => 'required',
            'department_id' => 'required',
            'designation_id' => 'required',
            'phone_number' => 'required',
            'email' => 'required|email|unique:users,email,' . $this->id, // Checks for uniqueness in users table
            'hire_date' => 'required|date',
            'is_active' => 'required|boolean',
        ]);
        $user_id = Auth::user()->id;

        // Create a new GeneralEmployee record
        $employee = GeneralEmployee::create([
            'first_name' => $this->first_name,
            'last_name' => $this->last_name ?? null,
            'employee_code' => date('Y') . str_pad(GeneralEmployee::whereYear('created_at', date('Y'))->count() + 1, 4, '0', STR_PAD_LEFT),
            'department_id' => $this->department_id,
            'designation_id' => $this->designation_id,
            'specialty' => $this->specialty ?? null,
            'experience_years' => $this->experience_years ?? null,
            'phone_number' => $this->phone_number,
            'hire_date' => $this->hire_date,
            'email' => $this->email,
            'address' => $this->address ?? null,
            'is_active' => $this->is_active,
            'created_by' => $user_id,
        ]);

        // Create a new User record linked to this employee
        User::create([
            'name' => $this->first_name . ' ' . $this->last_name ?? null,
            'username' => $this->first_name,
            'email' => $this->email,
            'password' => bcrypt('123456'),
            'phone' => $this->phone_number,
            'role' =>'admin',
            'address' => $this->address ?? null,
            'status' => $this->is_active,
        ]);

        $this->resetInputFields();
        $this->dispatch('close-modal');
        $this->dispatch('save-modal');
        $this->dispatch('success', message: 'Record created successfully.');
    }

    public function edit($id)
    {
        $data = GeneralEmployee::findOrFail($id);
        $this->id = $data->id;
        $this->first_name = $data->first_name;
        $this->last_name = $data->last_name;
        $this->department_id = $data->department_id;
        $this->designation_id = $data->designation_id;
        $this->specialty = $data->specialty;
        $this->experience_years = $data->experience_years;
        $this->phone_number = $data->phone_number;
        $this->email = $data->email;
        $this->address = $data->address;
        $this->is_active = $data->is_active;

        $this->openModal();
    }

    public function update()
    {
        $this->validate([
            'first_name' => 'required',
            'department_id' => 'required',
            'designation_id' => 'required',
            'phone_number' => 'required',
            'email' => 'required|email|unique:users,email,' . $this->id, // Checks for uniqueness in users table
            'hire_date' => 'required|date',
            'is_active' => 'required|boolean',
        ]);

        // Update GeneralEmployee record
        $data = GeneralEmployee::findOrFail($this->id);

        $data->update([
            'first_name' => $this->first_name,
            'last_name' => $this->last_name ?? null,
            'employee_code' => $this->employee_code,
            'department_id' => $this->department_id,
            'designation_id' => $this->designation_id,
            'specialty' => $this->specialty ?? null,
            'experience_years' => $this->experience_years ?? null,
            'phone_number' => $this->phone_number,
            'email' => $this->email,
            'address' => $this->address ?? null,
            'is_active' => $this->is_active,
            'updated_by' => Auth::user()->id,
        ]);

        // Update User record
        $user = User::where('email', $this->email)->first();
        if ($user) {
            $user->update([
                'name' => $this->first_name . ' ' . $this->last_name ?? null,
                'username' => $this->first_name,
                'phone' => $this->phone_number,
                'role' =>'admin',
                'address' => $this->address ?? null,
                'status' => $this->is_active,
            ]);
        }

        $this->resetInputFields();
        $this->dispatch('close-modal');
        $this->dispatch('save-modal');
        $this->dispatch('success', message: 'Record updated successfully.');
    }

    public function delete($id)
    {
        $data = GeneralEmployee::findOrFail($id);
        $data->update(['is_delete' => 1]);
        $this->dispatch('error', message: 'Record marked as deleted successfully.');
    }

}
