<?php

namespace App\Livewire\Reception;

use Livewire\Component;
use App\Models\Models\Surgery;
use App\Models\Models\SurgeryType;
use App\Models\Models\PatientSurgery;
use App\Models\Reception\Patient;
use App\Models\General\Employee;
use Livewire\WithPagination;
use Livewire\WithFileUploads;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;
use Carbon\Carbon;

class SurgeryManagement extends Component
{
    use WithPagination, WithFileUploads;

    // Surgery properties
    public $surgery_id, $name, $type_id, $cost, $description;
    
    // Surgery Type properties
    public $surgeryType_id, $typeName, $typeDescription;
    
    // Patient Surgery properties
    public $patient_id, $doctor_id, $surgery_date, $notes, $status, $payment_status;
    public $patientSurgeryId, $total_cost;
    
    // Patient Lookup properties
    public $patientLookupId;
    public $patientLookupError;
    
    // UI control properties
    public $isOpen = 0;
    public $isSurgeryTypeOpen = 0;
    public $search = '';
    public $selected_data;
    
    // Search and filter properties
    public $searchById = '', $searchByPatient = '', $searchByDoctor = '', $searchBySurgery = '';
    public $searchFromDate = '', $searchToDate = '';
    public $searchFromId = '', $searchToId = '';
    public $searchByPaymentStatus = '';
    public $searchResults = [];
    public $totalSurgeryCost = 0;
    
    protected $paginationTheme = 'bootstrap';
    
    // Reset filters
    public function resetFilters()
    {
        $this->searchById = '';
        $this->searchByPatient = '';
        $this->searchByDoctor = '';
        $this->searchBySurgery = '';
        $this->searchFromDate = '';
        $this->searchToDate = '';
        $this->searchFromId = '';
        $this->searchToId = '';
        $this->searchByPaymentStatus = '';
        $this->search = '';
        $this->searchResults = [];
        $this->totalSurgeryCost = 0;
    }
    
    // Search functionality
    public function searchDetails()
    {
        session()->put('print_filters', [
            'searchById'          => $this->searchById,
            'searchByPatient'     => $this->searchByPatient,
            'searchByDoctor'      => $this->searchByDoctor,
            'searchBySurgery'     => $this->searchBySurgery,
            'searchFromDate'      => $this->searchFromDate,
            'searchToDate'        => $this->searchToDate,
            'searchFromId'        => $this->searchFromId,
            'searchToId'          => $this->searchToId,
            'searchByPaymentStatus' => $this->searchByPaymentStatus,
        ]);

        $query = PatientSurgery::with(['patient', 'surgery', 'doctor'])
            ->where('is_delete', 0);

        if (!empty($this->searchById)) {
            $query->where('id', $this->searchById);
        }
        
        // ID range search
        if (!empty($this->searchFromId) && !empty($this->searchToId)) {
            $query->whereBetween('id', [$this->searchFromId, $this->searchToId]);
        }
        
        if (!empty($this->searchByPatient)) {
            $query->whereHas('patient', function ($q) {
                $q->where('name', 'like', '%' . $this->searchByPatient . '%');
            });
        }
        
        if (!empty($this->searchByDoctor)) {
            $query->whereHas('doctor', function ($q) {
                $q->whereRaw("CONCAT(first_name, ' ', last_name) like ?", ['%' . $this->searchByDoctor . '%']);
            });
        }
        
        if (!empty($this->searchBySurgery)) {
            $query->whereHas('surgery', function ($q) {
                $q->where('name', 'like', '%' . $this->searchBySurgery . '%');
            });
        }
        
        if (!empty($this->searchByPaymentStatus)) {
            $query->where('payment_status', $this->searchByPaymentStatus);
        }
        
        if (!empty($this->searchFromDate) && !empty($this->searchToDate)) {
            $query->whereBetween('surgery_date', [
                Carbon::parse($this->searchFromDate)->startOfDay(),
                Carbon::parse($this->searchToDate)->endOfDay()
            ]);
        }

        $this->searchResults = $query->orderBy('surgery_date', 'desc')->get();
        
        // Calculate total cost
        $this->totalSurgeryCost = $this->searchResults->sum('cost');
        
        // Dispatch event to open the modal
        $this->dispatch('open-search-modal');
    }
    
    // Close search modal
    public function closeSearchModal()
    {
        $this->searchResults = [];
        $this->totalSurgeryCost = 0;
    }
    
    // Details modal
    public function showDetails($id)
    {
        $this->selected_data = PatientSurgery::with(['patient', 'surgery', 'doctor'])->findOrFail($id);
        $this->dispatch('open-details-modal');
    }
    
    public function closeDetailsModal()
    {
        $this->selected_data = null;
    }
    
    // Surgery Type Methods
    public function createSurgeryType()
    {
        $this->resetSurgeryTypeInputs();
        $this->dispatch('open-surgery-type-modal');
    }
    
    public function resetSurgeryTypeInputs()
    {
        $this->surgeryType_id = null;
        $this->typeName = '';
        $this->typeDescription = '';
    }
    
    public function editSurgeryType($id)
    {
        $surgeryType = SurgeryType::findOrFail($id);
        $this->surgeryType_id = $surgeryType->id;
        $this->typeName = $surgeryType->name;
        $this->typeDescription = $surgeryType->description;
        $this->dispatch('open-surgery-type-modal');
    }
    
    public function saveSurgeryType()
    {
        $this->validate([
            'typeName' => 'required|string|max:255',
            'typeDescription' => 'nullable|max:255',
        ]);
        
        if ($this->surgeryType_id) {
            // Update existing
            $surgeryType = SurgeryType::findOrFail($this->surgeryType_id);
            $surgeryType->update([
                'name' => $this->typeName,
                'description' => $this->typeDescription,
                'is_active' => 1,
                'is_delete' => 0,
            ]);
            $message = 'Surgery type updated successfully';
        } else {
            // Create new
            SurgeryType::create([
                'name' => $this->typeName,
                'description' => $this->typeDescription,
                'is_active' => 1,
                'is_delete' => 0,
            ]);
            $message = 'Surgery type added successfully';
        }
        
        $this->resetSurgeryTypeInputs();
        $this->dispatch('close-surgery-type-modal');
        $this->dispatch('success', ['message' => $message]);
    }
    
    public function deleteSurgeryType($id)
    {
        // Check if any surgeries use this type
        $hasDependent = Surgery::where('type_id', $id)->exists();
        
        if ($hasDependent) {
            $this->dispatch('error', ['message' => 'Cannot delete: Surgery type is in use']);
            return;
        }
        
        $surgeryType = SurgeryType::findOrFail($id);
        $surgeryType->update(['is_delete' => 1]);
        $this->dispatch('success', ['message' => 'Surgery type deleted successfully']);
    }
    
    // Surgery Methods
    public function createSurgery()
    {
        $this->resetSurgeryInputs();
        $this->dispatch('open-surgery-modal');
    }
    
    public function resetSurgeryInputs()
    {
        $this->surgery_id = null;
        $this->name = '';
        $this->type_id = '';
        $this->cost = '';
        $this->description = '';
    }
    
    public function editSurgery($id)
    {
        $surgery = Surgery::findOrFail($id);
        $this->surgery_id = $surgery->id;
        $this->name = $surgery->name;
        $this->type_id = $surgery->type_id;
        $this->cost = $surgery->cost;
        $this->description = $surgery->description;
        $this->dispatch('open-surgery-modal');
    }
    
    public function saveSurgery()
    {
        $this->validate([
            'name' => 'required|string|max:255',
            'type_id' => 'required|exists:surgery_types,id',
            'cost' => 'required|numeric|min:0',
            'description' => 'nullable|max:255',
        ]);
        
        if ($this->surgery_id) {
            // Update existing
            $surgery = Surgery::findOrFail($this->surgery_id);
            $surgery->update([
                'name' => $this->name,
                'type_id' => $this->type_id,
                'cost' => $this->cost,
                'description' => $this->description,
                'is_active' => 1,
                'is_delete' => 0,
            ]);
            $message = 'Surgery updated successfully';
        } else {
            // Create new
            Surgery::create([
                'name' => $this->name,
                'type_id' => $this->type_id,
                'cost' => $this->cost,
                'description' => $this->description,
                'is_active' => 1,
                'is_delete' => 0,
            ]);
            $message = 'Surgery added successfully';
        }
        
        $this->resetSurgeryInputs();
        $this->dispatch('close-surgery-modal');
        $this->dispatch('success', ['message' => $message]);
    }
    
    public function deleteSurgery($id)
    {
        // Check if any patient surgeries use this surgery
        $hasDependent = PatientSurgery::where('surgery_id', $id)->exists();
        
        if ($hasDependent) {
            $this->dispatch('error', ['message' => 'Cannot delete: Surgery is assigned to patients']);
            return;
        }
        
        $surgery = Surgery::findOrFail($id);
        $surgery->update(['is_delete' => 1]);
        $this->dispatch('success', ['message' => 'Surgery deleted successfully']);
    }
    
    // Patient Surgery Methods
    public function createPatientSurgery()
    {
        $this->resetPatientSurgeryInputs();
        $this->dispatch('open-patient-surgery-modal');
    }
    
    public function resetPatientSurgeryInputs()
    {
        $this->patientSurgeryId = null;
        $this->patient_id = '';
        $this->doctor_id = '';
        $this->surgery_id = '';
        $this->surgery_date = date('Y-m-d');
        $this->status = 'scheduled';
        $this->notes = '';
        $this->total_cost = '';
    }
    
    public function editPatientSurgery($id)
    {
        $patientSurgery = PatientSurgery::findOrFail($id);
        $this->patientSurgeryId = $patientSurgery->id;
        $this->patient_id = $patientSurgery->patient_id;
        $this->doctor_id = $patientSurgery->doctor_id;
        $this->surgery_id = $patientSurgery->surgery_id;
        $this->surgery_date = $patientSurgery->surgery_date;
        $this->status = $patientSurgery->status;
        $this->payment_status = $patientSurgery->payment_status;
        $this->notes = $patientSurgery->notes;
        $this->total_cost = $patientSurgery->cost;
        $this->dispatch('open-patient-surgery-modal');
    }
    
    public function savePatientSurgery()
    {
        $this->validate([
            'patient_id' => 'required|exists:patients,id',
            'doctor_id' => 'required|exists:employees,id',
            'surgery_id' => 'required|exists:surgeries,id',
            'surgery_date' => 'required|date',
            'status' => 'required|in:scheduled,in_progress,completed,cancelled',
            'payment_status' => 'required|in:pending,paid,partial,cancelled',
            'notes' => 'nullable|max:1000',
            'total_cost' => 'nullable|numeric|min:0',
        ]);
        
        // Get the default cost from surgery if not specified
        if (empty($this->total_cost)) {
            $surgery = Surgery::findOrFail($this->surgery_id);
            $this->total_cost = $surgery->cost;
        }
        
        if ($this->patientSurgeryId) {
            // Update existing
            $patientSurgery = PatientSurgery::findOrFail($this->patientSurgeryId);
            $patientSurgery->update([
                'patient_id' => $this->patient_id,
                'doctor_id' => $this->doctor_id,
                'surgery_id' => $this->surgery_id,
                'surgery_date' => $this->surgery_date,
                'status' => $this->status,
                'payment_status' => $this->payment_status,
                'notes' => $this->notes,
                'cost' => $this->total_cost,
                'updated_by' => Auth::id(),
            ]);
            $message = 'Patient surgery record updated successfully';
        } else {
            // Create new
            PatientSurgery::create([
                'patient_id' => $this->patient_id,
                'doctor_id' => $this->doctor_id,
                'surgery_id' => $this->surgery_id,
                'surgery_date' => $this->surgery_date,
                'status' => $this->status,
                'payment_status' => $this->payment_status ?? 'pending',
                'notes' => $this->notes,
                'cost' => $this->total_cost,
                'created_by' => Auth::id(),
                'is_active' => 1,
                'is_delete' => 0,
            ]);
            $message = 'Patient surgery record created successfully';
        }
        
        $this->resetPatientSurgeryInputs();
        $this->dispatch('close-patient-surgery-modal');
        $this->dispatch('success', ['message' => $message]);
    }
    
    public function deletePatientSurgery($id)
    {
        $patientSurgery = PatientSurgery::findOrFail($id);
        $patientSurgery->update([
            'is_delete' => 1,
            'deleted_by' => Auth::id(),
        ]);
        $this->dispatch('success', ['message' => 'Patient surgery record deleted successfully']);
    }
    
    // Patient lookup by ID
    public function lookupPatient()
    {
        $this->patientLookupError = '';
        
        if (empty($this->patientLookupId)) {
            $this->patientLookupError = 'Please enter a patient ID';
            return;
        }
        
        $patient = Patient::where('id', $this->patientLookupId)
            ->where('is_active', 1)
            ->where('is_delete', 0)
            ->first();
        
        if ($patient) {
            $this->patient_id = $patient->id;
            $this->patientLookupId = ''; // Clear the input field
        } else {
            $this->patientLookupError = 'Patient not found with ID: ' . $this->patientLookupId;
        }
    }
    
    // Toggle payment status between pending and paid
    public function togglePaymentStatus($id)
    {
        $patientSurgery = PatientSurgery::findOrFail($id);
        
        // Toggle between pending and paid
        $newStatus = $patientSurgery->payment_status === 'pending' ? 'paid' : 'pending';
        
        $patientSurgery->update([
            'payment_status' => $newStatus,
            'updated_by' => Auth::id(),
        ]);
        
        $statusText = ucfirst($newStatus);
        $this->dispatch('success', ['message' => "Payment status updated to $statusText"]);
    }
    
    public function render()
    {
        $patients = Patient::where('is_active', 1)
            ->where('is_delete', 0)
            ->orderBy('name')
            ->get();
            
        $doctors = Employee::where('is_delete', 0)
            ->where('is_active', 1)
            ->whereHas('designation', function ($query) {
                $query->where('name', 'like', '%doctor%');
            })
            ->get();
            
        $surgeryTypes = SurgeryType::where('is_delete', 0)
            ->orderBy('name')
            ->get();
        
        $surgeries = Surgery::with('surgeryType')
            ->where('is_delete', 0)
            ->orderBy('name')
            ->get();
            
        $patientSurgeriesQuery = PatientSurgery::with(['patient', 'surgery', 'doctor'])
            ->where('is_delete', 0);
            
        // Apply search filter
        if (!empty($this->search)) {
            $patientSurgeriesQuery->where(function($query) {
                $query->whereHas('patient', function($q) {
                    $q->where('name', 'like', '%' . $this->search . '%');
                })
                ->orWhereHas('surgery', function($q) {
                    $q->where('name', 'like', '%' . $this->search . '%');
                })
                ->orWhereHas('doctor', function($q) {
                    $q->where(function($q) {
                        $q->where('first_name', 'like', '%' . $this->search . '%')
                          ->orWhere('last_name', 'like', '%' . $this->search . '%');
                    });
                });
            });
        }
        
        // Apply sort order
        $patientSurgeriesQuery->orderBy('surgery_date', 'desc');
        
        $patientSurgeries = $this->search ? 
            $patientSurgeriesQuery->get() : 
            $patientSurgeriesQuery->paginate(10);
            
        return view('livewire.reception.surgery-management', [
            'patients' => $patients,
            'doctors' => $doctors,
            'surgeryTypes' => $surgeryTypes,
            'surgeries' => $surgeries,
            'patientSurgeries' => $patientSurgeries,
        ]);
    }
}