<?php

namespace App\Livewire\Laboratory;

use App\Models\General\Service;
use App\Models\Laboratory\TestDetail as LaboratoryTestDetail;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;

class TestDetail extends Component
{
    public $id, $test_type_id, $name, $normal_range, $unit, $description, $created_by, $updated_by, $deleted_by, $is_active, $is_delete;

    public $search = ''; // Add a search variable
    public $isOpen = 0;

    protected $paginationTheme = 'bootstrap'; 
    
    public function render()
    {
        // Get all active lab test services
        $services = Service::where('is_active', 1)->where('is_delete', 0)->where('is_lab_test', 1)->get();
    
        // Add a search filter
        $test_details_query = LaboratoryTestDetail::with(['service', 'user'])
            ->where('is_delete', 0) // Only display records where is_delete is 0
            ->where(function ($query) {
                $query->where('name', 'like', '%' . $this->search . '%') // Search filter for test_details type
                    ->orWhereHas('user', function ($query) {
                        $query->where('name', 'like', '%' . $this->search . '%'); // Search filter for creator's name
                    });
            });
    
        // Apply pagination or get all results based on the presence of the search term
        if ($this->search) {
            $test_details = $test_details_query->get();
        } else {
            $test_details = $test_details_query->paginate(10);
        }
    
        return view('livewire.laboratory.test-detail', [
            'test_details' => $test_details,
            'services' => $services,
            'search' => $this->search
        ]);
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
        $this->test_type_id = '';
        $this->name = '';
        $this->normal_range = '';
        $this->unit = '';
        $this->description = '';
        $this->is_active = 1;
    }

    public function add()
    {
        $this->validate([
            'test_type_id' => 'required',
            'name' => 'required',
            'normal_range' => 'required',
            'unit' => 'required',
            'is_active' => 'required|boolean',
        ]);

        $user_id = Auth::user()->id;

        LaboratoryTestDetail::create([
            'test_type_id' => $this->test_type_id,
            'name' => $this->name,
            'normal_range' => $this->normal_range,
            'unit' => $this->unit,
            'description' => $this->description ? $this->description : null,
            'created_by' => $user_id,
            'is_active' => $this->is_active,
        ]);

        $this->resetInputFields();
        $this->dispatch('close-modal');
        $this->dispatch('save-modal');
        $this->dispatch('success', message: 'Record created successfully.');
    }

    public function edit($id)
    {
        $data = LaboratoryTestDetail::findOrFail($id);
        $this->id = $data->id;
        $this->test_type_id = $data->test_type_id;
        $this->name = $data->name;
        $this->normal_range = $data->normal_range;
        $this->unit = $data->unit;
        $this->description = $data->description;
        $this->is_active = $data->is_active;

        $this->openModal();
    }

    public function update()
    {
        $this->validate([
            'test_type_id' => 'required',
            'name' => 'required',
            'normal_range' => 'required',
            'unit' => 'required',
            'is_active' => 'required|boolean',
        ]);

        $data = LaboratoryTestDetail::findOrFail($this->id);

        $data->update([
            'test_type_id' => $this->test_type_id,
            'name' => $this->name,
            'normal_range' => $this->normal_range,
            'unit' => $this->unit,
            'description' => $this->description ? $this->description : null,
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
        $data = LaboratoryTestDetail::findOrFail($id);
        $data->update(['is_delete' => 1]);
        $data->update(['deleted_by' => Auth::user()->id]);
        $this->dispatch('error', message: 'Record marked as deleted successfully.');
    }
}
