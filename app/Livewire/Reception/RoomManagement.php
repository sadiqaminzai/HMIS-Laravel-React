<?php

namespace App\Livewire\Reception; // Adjust namespace if needed

use App\Models\Reception\Room; // Make sure Room model exists and namespace is correct
// Removed: use App\Models\User; as created_by/updated_by are not listed
use Livewire\Component;
// Removed: use Illuminate\Support\Facades\Auth; as created_by/updated_by are not listed
use Livewire\WithPagination;

class RoomManagement extends Component
{
    use WithPagination;

    // Properties for Room model fields - Adjusted: removed floor, renamed rate_per_day
    // $room_type property corresponds to the form input, maps to 'type' column
    public $id, $room_number, $room_type, $total_beds, $available_beds, $cost_per_bed, $is_active = 1;

    // Properties for modal control and data
    public $search = '';
    public $isOpen = 0; // Matches pattern, optional
    public $selected_data = null; // For details modal

    protected $paginationTheme = 'bootstrap';

    // Validation rules - Adjusted: removed floor, renamed rate_per_day key
    protected function rules()
    {
        return [
            'room_number' => 'required|string|max:50|unique:rooms,room_number,' . $this->id,
            'room_type' => 'required|string|in:General,Private,Semi-Private,ICU,Emergency', // Validates the component property value from the dropdown
            'total_beds' => 'required|integer|min:0',
            'available_beds' => 'required|integer|min:0|lte:total_beds', // Available cannot exceed total
            'cost_per_bed' => 'required|numeric|min:0', // Changed key from rate_per_day
            'is_active' => 'required|boolean',
        ];
    }

    // Real-time validation
    public function updated($propertyName)
    {
        $this->validateOnly($propertyName);
    }

     // Reset pagination on search
     public function updatingSearch()
     {
         $this->resetPage();
     }

    // --- Details Modal Methods ---
    public function showDetails($id)
    {
        // Removed eager loading for user/updater as they are not listed in schema
        $this->selected_data = Room::find($id);

        if ($this->selected_data) {
            $this->dispatch('open-modal', 'detailsModal');
        } else {
             $this->dispatch('error', message: 'Room details not found.');
        }
    }

    public function closeDetailsModal()
    {
        $this->selected_data = null;
        $this->dispatch('close-modal', 'detailsModal');
    }

    // --- Render Method ---
    public function render()
    {
        // Adjusted query: use 'type' column, removed 'floor' search
        $query = Room::where('is_delete', 0)
            ->where(function ($q) {
                $q->where('room_number', 'like', '%' . $this->search . '%')
                  ->orWhere('type', 'like', '%' . $this->search . '%') // Search on 'type' column
                  ->orWhere('id', 'like', '%' . $this->search . '%');
            });

        $rooms = $this->search ? $query->orderBy('room_number','asc')->get() : $query->orderBy('room_number','asc')->paginate(10);

        return view('livewire.reception.room-management', [
            'rooms' => $rooms,
        ]);
    }

    // --- Edit/Create Modal Methods ---
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

    // Adjusted: removed floor, renamed rate_per_day
    private function resetInputFields()
    {
        $this->id = null;
        $this->room_number = '';
        $this->room_type = ''; // Component property for dropdown
        $this->total_beds = '';
        $this->available_beds = '';
        $this->cost_per_bed = ''; // Changed from rate_per_day
        // Removed floor
        $this->is_active = 1;
        $this->resetErrorBag();
    }

    public function add()
    {
        $validatedData = $this->validate();

        if ($validatedData['available_beds'] > $validatedData['total_beds']) {
            $this->addError('available_beds', 'Available beds cannot exceed total beds.');
            return;
        }

        // Prepare data for database insertion - map properties to columns
        $dataToSave = [
            'room_number' => $validatedData['room_number'],
            'type' => $validatedData['room_type'], // Map room_type property to type column
            'total_beds' => $validatedData['total_beds'],
            'available_beds' => $validatedData['available_beds'],
            'cost_per_bed' => $validatedData['cost_per_bed'], // Map cost_per_bed property to cost_per_bed column
            'is_active' => $validatedData['is_active'],
            // 'created_by' => Auth::id(), // Removed as not in schema
        ];

        Room::create($dataToSave);

        $this->resetInputFields();
        $this->dispatch('close-modal');
        $this->dispatch('save-modal');
        $this->dispatch('success', message: 'Room created successfully.');
    }

    public function edit($id)
    {
        $data = Room::find($id);
        if ($data) {
            $this->id = $id;
            $this->room_number = $data->room_number;
            $this->room_type = $data->type; // Load 'type' column into room_type property
            $this->total_beds = $data->total_beds;
            $this->available_beds = $data->available_beds;
            $this->cost_per_bed = $data->cost_per_bed; // Load cost_per_bed column
            // Removed floor
            $this->is_active = $data->is_active;
            $this->resetErrorBag();
            $this->openModal();
        } else {
            $this->dispatch('error', message: 'Room not found.');
        }
    }

    public function update()
    {
        $validatedData = $this->validate();

        if ($validatedData['available_beds'] > $validatedData['total_beds']) {
            $this->addError('available_beds', 'Available beds cannot exceed total beds.');
            return;
        }

        if ($this->id) {
            $data = Room::find($this->id);
            if ($data) {
                 // Prepare data for database update - map properties to columns
                $dataToUpdate = [
                    'room_number' => $validatedData['room_number'],
                    'type' => $validatedData['room_type'], // Map room_type property to type column
                    'total_beds' => $validatedData['total_beds'],
                    'available_beds' => $validatedData['available_beds'],
                    'cost_per_bed' => $validatedData['cost_per_bed'], // Map cost_per_bed property to cost_per_bed column
                    'is_active' => $validatedData['is_active'],
                    // 'updated_by' => Auth::id(), // Removed as not in schema
                ];
                $data->update($dataToUpdate);

                $this->resetInputFields();
                $this->dispatch('close-modal');
                $this->dispatch('save-modal');
                $this->dispatch('success', message: 'Room updated successfully.');
            } else {
                $this->dispatch('error', message: 'Room not found for update.');
            }
        }
    }

    // --- Delete Method ---
     public function delete($id)
     {
         $data = Room::find($id);
         if ($data) {
            // Update only is_delete based on provided schema
             $data->update([
                 'is_delete' => 1,
                 // 'deleted_by' => Auth::id() // Removed as not in schema
             ]);
              $this->dispatch('error', message: 'Room marked as deleted successfully.');
         } else {
             $this->dispatch('error', message: 'Room not found for deletion.');
         }
     }
}