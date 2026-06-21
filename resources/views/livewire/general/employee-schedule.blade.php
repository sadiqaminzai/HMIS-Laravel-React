<div class="container">
    <!-- Add Employee Button and Search Input -->
    <!-- Employee Table -->
    <div class="row mb-2">
        <div class="col-md-6">
            <h3>Employee Schedule</h3>
        </div>
        <div class="col-md-3"></div>
        <div class="col-md-3">
            <input type="text" wire:model.live="search" class="form-control" placeholder="Search here...">
        </div>
    </div>

    <div class="table-responsive">
        <table class="table table-bordered mt-5">
            <thead>
                <tr>
                    <th>S.No</th>
                    <th>First Name</th>
                    <th>Last Name</th>
                    <th>Employee Code</th>
                    <th>Email</th>
                    @if(Auth::user()->can('employee.schedule.add') ||Auth::user()->can('employee.schedule.delete')|| Auth::user()->can('employee.schedule.details'))

                    <th>Action</th>
                    @endif
                </tr>
            </thead>
            <tbody>
                @foreach($employees as $employee)
                <tr>
                    <td>{{ $loop->iteration }}</td>
                    <td>{{ $employee->first_name ?? 'N/A' }}</td>
                    <td>{{ $employee->last_name ?? 'N/A' }}</td>
                    <td>{{ $employee->employee_code }}</td>
                    <td>{{ $employee->email }}</td>
                    @if(Auth::user()->can('employee.schedule.add') ||Auth::user()->can('employee.schedule.delete')|| Auth::user()->can('employee.schedule.details'))
                    <td>
                        @if(Auth::user()->can('employee.schedule.details'))

                        <button wire:click="showDetails({{ $employee->id }})" class="btn btn-info btn-sm" data-bs-toggle="modal" data-bs-target="#detailsModal">Details</button>
                        @endif
                        @if(Auth::user()->can('employee.schedule.delete'))

                        <button wire:click="delete({{ $employee->id }})" class="btn btn-danger btn-sm">Delete</button>
                        @endif
                        @if(Auth::user()->can('employee.schedule.add'))

                        <button wire:click="openScheduleModal({{ $employee->id }})" class="btn btn-success btn-sm" data-bs-toggle="modal" data-bs-target="#scheduleModal">Add Schedule</button>
                        @endif

                    </td>
                    @endif
                </tr>
                @endforeach
            </tbody>
        </table>
    </div>
    {{ $employees->links() }}

    <!-- Schedule Modal -->
    <div wire:ignore.self class="modal fade" id="scheduleModal" tabindex="-1" role="dialog" aria-labelledby="scheduleModalLabel" aria-hidden="true">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="scheduleModalLabel">Add/Edit Schedule</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeScheduleModal()"></button>
                </div>
                <div class="modal-body">
                    <!-- Schedule Form Fields -->
                    <div class="form-group">
                        <label for="available_days">Available Days (comma-separated)</label>
                        <input type="text" wire:model="available_days" id="available_days" class="form-control">
                        @error('available_days') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>
                    <div class="form-group">
                        <label for="start_time">Start Time</label>
                        <input type="time" wire:model="start_time" id="start_time" class="form-control">
                        @error('start_time') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>
                    <div class="form-group">
                        <label for="end_time">End Time</label>
                        <input type="time" wire:model="end_time" id="end_time" class="form-control">
                        @error('end_time') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>
                    <div class="form-group">
                        <label for="consultation_slot">Consultation Slot (in minutes)</label>
                        <input type="number" wire:model="consultation_slot" id="consultation_slot" class="form-control">
                        @error('consultation_slot') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>
                    <div class="form-group">
                        <label for="is_active">Active</label>
                        <select wire:model="is_active" id="is_active" class="form-control">
                            <option value="1">Yes</option>
                            <option value="0">No</option>
                        </select>
                        @error('is_active') <span class="text-danger">{{ $message }}</span> @enderror
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="button" wire:click="saveSchedule" class="btn btn-success">Save Schedule</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Details Modal for Employee Schedule -->
   <!-- Details Modal for Employee Schedule -->
<div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog" aria-labelledby="detailsModalLabel" aria-hidden="true">
    <div class="modal-dialog modal-lg" role="document">
        <div class="modal-content">
            <div class="modal-header">
                <h5 class="modal-title" id="detailsModalLabel">Employee Schedule Details</h5>
                <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
            </div>
            <div class="modal-body">
                @if($selectedSchedule && $selectedSchedule->isNotEmpty())
                    @foreach($selectedSchedule as $schedule)
                        <div class="row g-3 mb-4">
                            <div class="col-md-6">
                                <div class="p-3 rounded border"><strong>Doctor:</strong> {{ $schedule->Employee->first_name }}</div>
                            </div>
                            <div class="col-md-6">
                                <div class="p-3 rounded border"><strong>Available Days:</strong> {{ $schedule->available_days }}</div>
                            </div>
                            <div class="col-md-6">
                                <div class="p-3 rounded border"><strong>Start Time:</strong> {{ $schedule->start_time }}</div>
                            </div>
                            <div class="col-md-6">
                                <div class="p-3 rounded border"><strong>End Time:</strong> {{ $schedule->end_time }}</div>
                            </div>
                            <div class="col-md-6">
                                <div class="p-3 rounded border"><strong>Consultation Slot:</strong> {{ $schedule->consultation_slot }} minutes</div>
                            </div>
                            <div class="col-md-6">
                                <div class="p-3 rounded border"><strong>Status:</strong> {{ $schedule->is_active ? 'Active' : 'Inactive' }}</div>
                            </div>
                        </div>
                        <hr>
                    @endforeach
                @else
                    <p>No schedules available for this employee.</p>
                @endif
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
            </div>
        </div>
    </div>
</div>

</div>

<script>
    document.addEventListener('livewire:load', function() {
        window.addEventListener('open-schedule-modal', () => {
            var modal = new bootstrap.Modal(document.getElementById('scheduleModal'));
            modal.show();
        });
        window.addEventListener('close-schedule-modal', () => {
            var modal = bootstrap.Modal.getInstance(document.getElementById('scheduleModal'));
            modal.hide();
        });
    });
    window.addEventListener('save-modal', () => {
        var modal = bootstrap.Modal.getInstance(document.getElementById('scheduleModal'));
        modal.hide();
    });
</script>
