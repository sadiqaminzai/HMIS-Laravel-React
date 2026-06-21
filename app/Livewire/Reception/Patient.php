<?php

namespace App\Livewire\Reception;

use App\Models\Reception\Patient as ReceptionPatient;
use Livewire\Component;
use Illuminate\Support\Facades\Auth;
use Livewire\WithFileUploads;
use Livewire\WithPagination;

class Patient extends Component
{
    use WithFileUploads, WithPagination;

    public $id, $name, $father_name, $mobile, $email, $age, $gender, $address, $city, $state, $zip_code, $emergency_contact_name, $emergency_contact_number, $created_by, $updated_by, $deleted_by, $is_active, $is_delete;

    public $search = ''; // Add a search variable
    public $isOpen = 0;
    public $selectedPatient;

    protected $paginationTheme = 'bootstrap';

    public function showDetails($id)
    {
        $this->selectedPatient = ReceptionPatient::with('user')->findOrFail($id);
        $this->dispatch('open-modal', 'detailsModal');
    }
    
    public function closeDetailsModal()
    {
        $this->selectedPatient = null;
        $this->dispatch('close-modal', 'detailsModal');
    }

    public function updatingSearch()
    {
        $this->resetPage(); // Reset pagination when search query is updated
    }

    public function render()
    {
        // Add a search filter
        $patients = ReceptionPatient::with('user')
            ->where('is_delete', 0) // Only display records where is_delete is 0
            ->where(function ($query) {
                $query->where('name', 'like', '%' . $this->search . '%') // Search filter for department name
                      ->orWhereHas('user', function ($query) {
                          $query->where('name', 'like', '%' . $this->search . '%'); // Search filter for creator's name
                      });
            })
            ->paginate(10); // Paginate results (adjust as needed)

        return view('livewire.reception.patient', ['patients' => $patients]);
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
        $this->name = '';
        $this->father_name = '';
        $this->mobile = '';
        $this->email = '';
        $this->age = '';
        $this->gender = '';
        $this->address = '';
        $this->city = '';
        $this->state = '';
        $this->zip_code = '';
        $this->emergency_contact_name = '';
        $this->emergency_contact_number = '';
        $this->is_active = 1;
    }

    public function add()
    {
        $this->validate([
            'name' => 'required',
            'age' => 'required|numeric',
            'address' => 'required',
            'is_active' => 'required|boolean',
        ]);

        $user_id = Auth::user()->id;

        ReceptionPatient::create([
            'name' => $this->name,
            'father_name' => $this->father_name ? $this->father_name : null,
            'mobile' => $this->mobile ? $this->mobile : null,
            'email' => $this->email ? $this->email : null,
            'age' => $this->age,
            'gender' => $this->gender,
            'address' => $this->address,
            'city' => $this->city ? $this->city : null,
            'state' => $this->state ? $this->state : null,
            'zip_code' => $this->zip_code ? $this->zip_code : null,
            'emergency_contact_name' => $this->emergency_contact_name ? $this->emergency_contact_name : null,
            'emergency_contact_number' => $this->emergency_contact_number ? $this->emergency_contact_number : null,
            'is_active' => $this->is_active,
            'created_by' => $user_id,
        ]);

        $this->resetInputFields();
        $this->dispatch('close-modal');
        $this->dispatch('save-modal');
        $this->dispatch('success', message: 'Record created successfully.');
    }

    public function edit($id)
    {
        $data = ReceptionPatient::findOrFail($id);
        $this->id = $data->id;
        $this->name = $data->name;
        $this->father_name = $data->father_name;
        $this->mobile = $data->mobile;
        $this->email = $data->email;
        $this->age = $data->age;
        $this->gender = $data->gender;
        $this->address = $data->address;
        $this->city = $data->city;
        $this->state = $data->state;
        $this->zip_code = $data->zip_code;
        $this->emergency_contact_name = $data->emergency_contact_name;
        $this->emergency_contact_number = $data->emergency_contact_number;
        $this->is_active = $data->is_active;

        $this->openModal();
    }

    public function update()
    {
        $this->validate([
            'name' => 'required',
            'age' => 'required',
            'address' => 'required',
            'is_active' => 'required|boolean',
        ]);

        $data = ReceptionPatient::findOrFail($this->id);

        $data->update([
            'name' => $this->name,
            'father_name' => $this->father_name ? $this->father_name : null,
            'mobile' => $this->mobile ? $this->mobile : null,
            'email' => $this->email ? $this->email : null,
            'age' => $this->age,
            'gender' => $this->gender,
            'address' => $this->address,
            'city' => $this->city ? $this->city : null,
            'state' => $this->state ? $this->state : null,
            'zip_code' => $this->zip_code ? $this->zip_code : null,
            'emergency_contact_name' => $this->emergency_contact_name ? $this->emergency_contact_name : null,
            'emergency_contact_number' => $this->emergency_contact_number ? $this->emergency_contact_number : null,
            'is_active' => $this->is_active,
            'updated_by' => Auth::user()->id,
        ]);

        $this->resetInputFields();
        $this->dispatch('close-modal');
        $this->dispatch('save-modal');
        $this->dispatch('success', message: 'Record updated successfully.');
    }

    public function delete($id)
    {
        $data = ReceptionPatient::findOrFail($id);
        $data->update(['is_delete' => 1]);
        $this->dispatch('error', message: 'Record marked as deleted successfully.');
    }
}
