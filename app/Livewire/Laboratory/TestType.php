<?php

namespace App\Livewire\Laboratory;

use App\Models\General\Service;
use Illuminate\Support\Facades\Auth;
use Livewire\Component;
use Livewire\WithPagination;

class TestType extends Component
{

    public $id, $name, $service_id, $created_by, $updated_by, $deleted_by, $is_active, $is_delete;

    public $search = '';
    public $isOpen = 0;

    protected $paginationTheme = 'bootstrap';


    public function render()
    {
        // Get all active lab test services
        $services_query = Service::where('is_active', 1)
            ->where('is_delete', 0)
            ->where('is_lab_test', 1)
            ->where(function ($query) {
                $query->where('name', 'like', '%' . $this->search . '%')
                    ->orWhere('id', 'like', '%' . $this->search . '%');
            });

        // Apply pagination or get all results based on the presence of the search term
        if ($this->search) {
            $services = $services_query->get();
        } else {
            $services = $services_query->paginate(10);
        }

        return view('livewire.laboratory.test-type', [
            'services' => $services,
            'search' => $this->search // Ensure search is passed to the view
        ]);
    }
}
