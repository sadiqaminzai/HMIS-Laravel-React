<?php

namespace App\Livewire\General;

use App\Models\General\Department;
use App\Models\General\Designation;
use App\Models\General\Employee;
use App\Models\General\EmployeeSchedule as GeneralEmployeeSchedule;
use App\Models\User;
use Livewire\Component;
use Illuminate\Support\Facades\Auth;
use Livewire\WithFileUploads;
use Livewire\WithPagination;

class EmployeeSchedule extends Component
{
    use WithPagination;

    public $available_days, $start_time, $end_time, $consultation_slot, $is_active;
    public $employee_id, $department_id, $schedule_id;
    public $selectedSchedule, $search;
    public $showScheduleModal = false;
    public $showDetailsModal = false;

    protected $rules = [
        'available_days' => 'required|string',
        'start_time' => 'required|date_format:H:i',
        'end_time' => 'required|date_format:H:i|after:start_time',
        'consultation_slot' => 'required|integer|min:10',
        'is_active' => 'required|boolean',
        'employee_id' => 'required|exists:employees,id',
        'department_id' => 'required|exists:departments,id'
    ];

    public function render()
    {
        $departments = Department::all();
        $designations = Designation::all();

        $employees = Employee::with(['Department', 'Designation', 'Created_By', 'Updated_By', 'Deleted_By'])
            ->where('is_delete', 0)
            ->where(function ($query) {
                $query->where('first_name', 'like', '%' . $this->search . '%')
                      ->orWhereHas('Created_By', function ($query) {
                          $query->where('name', 'like', '%' . $this->search . '%');
                      });
            })
            ->paginate(10);

        return view('livewire.general.employee-schedule', [
            'employees' => $employees,
            'departments' => $departments,
            'designations' => $designations
        ]);
    }

    public function openScheduleModal($employeeId)
    {
        $this->resetInputFields();

        $employee = Employee::findOrFail($employeeId);
        $this->employee_id = $employee->id;
        $this->department_id = $employee->department_id;

        $existingSchedule = GeneralEmployeeSchedule::where('employee_id', $employeeId)->first();

        if ($existingSchedule) {
            // Load existing schedule data if available
            $this->schedule_id = $existingSchedule->id;
            $this->available_days = $existingSchedule->available_days;
            $this->start_time = $existingSchedule->start_time;
            $this->end_time = $existingSchedule->end_time;
            $this->consultation_slot = $existingSchedule->consultation_slot;
            $this->is_active = $existingSchedule->is_active;
        }

        $this->showScheduleModal = true;
        $this->dispatch('open-schedule-modal');
    }

    public function closeScheduleModal()
    {
        $this->resetInputFields();
        $this->showScheduleModal = false;
        $this->dispatch('close-schedule-modal');
    }

    public function saveSchedule()
    {
        $this->validate();

        GeneralEmployeeSchedule::updateOrCreate(
            ['employee_id' => $this->employee_id],
            [
                'department_id' => $this->department_id,
                'available_days' => $this->available_days,
                'start_time' => $this->start_time,
                'end_time' => $this->end_time,
                'consultation_slot' => $this->consultation_slot,
                'is_active' => $this->is_active,
                'created_by' => Auth::id()
            ]
        );

        $this->closeScheduleModal();
        $this->dispatch('save-modal');
        $this->dispatch('success', message: 'Schedule saved successfully.');
    }

    public function showDetails($employeeId)
    {
        $this->selectedSchedule = GeneralEmployeeSchedule::with(['Department','Employee'])
            ->where('employee_id', $employeeId)
            ->get();

        $this->showDetailsModal = true;
        $this->dispatch('open-details-modal');
    }

    public function closeDetailsModal()
    {
        $this->showDetailsModal = false;
        $this->selectedSchedule = null;
        $this->dispatch('close-details-modal');
    }

    public function delete($employee_id)
    {
        GeneralEmployeeSchedule::where('employee_id', $employee_id)->delete();
        $this->dispatch('error', message: 'Record Deleted successfully.');
    }

    private function resetInputFields()
    {
        $this->schedule_id = null;
        $this->employee_id = null;
        $this->department_id = null;
        $this->available_days = '';
        $this->start_time = '';
        $this->end_time = '';
        $this->consultation_slot = '';
        $this->is_active = null;
    }
}
