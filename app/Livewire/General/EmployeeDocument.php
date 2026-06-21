<?php

namespace App\Livewire\General;

use App\Models\General\Department;
use App\Models\General\Designation;
use App\Models\General\Employee;
use App\Models\General\EmployeeDocument as GeneralEmployeeDocument;
use Livewire\Component;
use Illuminate\Support\Facades\Auth;
use Livewire\WithFileUploads;
use Livewire\WithPagination;

class EmployeeDocument extends Component
{
    use WithFileUploads, WithPagination;

    public $document_type = [], $document_url = [], $is_active;
    public $employee_id, $document_id;
    public $selectedDocument, $search;
    public $showDocumentModal = false;
    public $showDetailsModal = false;

    protected $rules = [
        'document_type' => 'required|array',
        'document_url.*' => 'required|file|mimes:pdf,doc,docx,jpg,png|max:2048', // Updated to support multiple files
        'is_active' => 'required|boolean',
        'employee_id' => 'required|exists:employees,id'
    ];
    public function render()
    {
        $employees = Employee::with('Department')
            ->where('is_delete', 0)
            ->where('first_name', 'like', '%' . $this->search . '%')
            ->paginate(10);

        return view('livewire.general.employee-document', [
            'employees' => $employees
        ]);
    }

    public function openDocumentModal($employeeId)
    {
        $this->resetInputFields();
        $this->employee_id = $employeeId;

        $existingDocument = GeneralEmployeeDocument::where('employee_id', $employeeId)->first();
        if ($existingDocument) {
            $this->document_id = $existingDocument->id;
            $this->document_type = $existingDocument->document_type;
            $this->document_url = $existingDocument->document_url;
            $this->is_active = $existingDocument->is_active;
        }
        $this->showDocumentModal = true;
    }

    public function closeDocumentModal()
    {
        $this->resetInputFields();
        $this->showDocumentModal = false;
    }

                public function saveDocument()
            {
                $this->validate();

                $documentTypes = implode(', ', $this->document_type);

                foreach ($this->document_url as $file) {
                    $filePath = $file->store('documents', 'public');

                    GeneralEmployeeDocument::create([
                        'employee_id' => $this->employee_id,
                        'document_type' => $documentTypes,
                        'document_url' => $filePath,
                        'is_active' => $this->is_active,
                        'created_by' => Auth::id(),
                    ]);
                }

                $this->closeDocumentModal();
                $this->dispatch('success', message: 'Documents saved successfully.');

            }

    public function showDetails($employeeId)
    {
        $this->selectedDocument = GeneralEmployeeDocument::with('Employee')
            ->where('employee_id', $employeeId)
            ->get();
        $this->showDetailsModal = true;
    }

    public function closeDetailsModal()
    {
        $this->showDetailsModal = false;
        $this->selectedDocument = null;
    }

    private function resetInputFields()
    {
        $this->document_id = null;
        $this->document_type = '';
        $this->document_url = '';
        $this->is_active = null;
    }
    public function deleteDocument($employeeId)
{
    GeneralEmployeeDocument::where('employee_id', $employeeId)->delete();
    $this->dispatch('error', message: 'Documents Deleted successfully.');
    $this->closeDetailsModal();
}
}
