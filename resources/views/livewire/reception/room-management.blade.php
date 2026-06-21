<div class="container">
    <div class="row mb-2">
        <div class="col-md-1">
            {{-- Add Permission Check if needed --}}
            <button class="btn btn-outline-primary btn-icon-text btn-sm" wire:click="create" data-bs-toggle="modal" data-bs-target="#modal" wire:ignore>
                <i class="btn-icon-prepend" data-feather="plus-circle"></i>Add
            </button>
        </div>
        <div class="col-md-8 text-start">
            <h3>Room Management</h3>
        </div>
        <div class="col-md-3">
            {{-- Adjusted Placeholder --}}
            <input type="text" wire:model.live="search" class="form-control" placeholder="Search Number, Type...">
        </div>
    </div>

    <div wire:ignore.self class="modal fade" id="modal" tabindex="-1" role="dialog" aria-labelledby="modalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalLabel">{{ $id ? 'Edit Room' : 'Create Room' }}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeModal()"></button>
                </div>

                <div class="modal-body">
                    <div class="row">
                        <div class="col-md-6 form-group mb-3">
                            <label for="room_number">Room Number <span class="text-danger">*</span></label>
                            <input type="text" class="form-control" id="room_number" wire:model="room_number">
                            @error('room_number') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>

                        <div class="col-md-6 form-group mb-3">
                            <label for="room_type">Room Type <span class="text-danger">*</span></label>
                            {{-- wire:model is correct here, maps to component property --}}
                            <select class="form-control" id="room_type" wire:model="room_type">
                                <option value="">Select Room Type</option>
                                <option value="General">General</option>
                                <option value="Private">Private</option>
                                <option value="Semi-Private">Semi-Private</option>
                                <option value="ICU">ICU</option>
                                <option value="Emergency">Emergency</option>
                            </select>
                            @error('room_type') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="row">
                        <div class="col-md-6 form-group mb-3">
                            <label for="total_beds">Total Beds <span class="text-danger">*</span></label>
                            <input type="number" class="form-control" id="total_beds" wire:model="total_beds">
                            @error('total_beds') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>

                        <div class="col-md-6 form-group mb-3">
                            <label for="available_beds">Available Beds <span class="text-danger">*</span></label>
                            <input type="number" class="form-control" id="available_beds" wire:model="available_beds">
                            @error('available_beds') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    <div class="row">
                        <div class="col-md-6 form-group mb-3">
                            {{-- Changed label and wire:model --}}
                            <label for="cost_per_bed">Cost Per Bed <span class="text-danger">*</span></label>
                            <input type="number" step="0.01" class="form-control" id="cost_per_bed" wire:model="cost_per_bed">
                            @error('cost_per_bed') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>

                         {{-- Removed Floor Input Row --}}

                         <div class="col-md-6 form-group mb-3">
                            {{-- Moved Status here to keep layout balanced --}}
                            <label for="is_active">Status</label>
                            <select wire:model="is_active" id="is_active" class="form-control">
                                <option value="1">Active</option>
                                <option value="0">Inactive</option>
                            </select>
                            @error('is_active') <span class="text-danger">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    {{-- Status row removed as it's combined above --}}

                </div>

                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" wire:click="closeModal()">Cancel</button>
                    <button type="button" wire:click="{{ $id ? 'update' : 'add' }}" class="btn btn-primary">
                        {{ $id ? 'Update' : 'Save' }}
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div class="table-responsive">
        <table class="table table-bordered">
            <thead>
                <tr>
                    <th>Room Number</th>
                    <th>Type</th>
                    <th>Total Beds</th>
                    <th>Available Beds</th>
                    <th>Cost/Bed</th> {{-- Changed Header --}}
                    {{-- Removed Floor Header --}}
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                @forelse($rooms as $room)
                <tr>
                    <td>{{ $room->room_number }}</td>
                    <td>{{ $room->type }}</td> {{-- Use 'type' column --}}
                    <td>{{ $room->total_beds }}</td>
                    <td>{{ $room->available_beds }}</td>
                    <td>{{ number_format($room->cost_per_bed ?? 0, 2) }}</td> {{-- Use 'cost_per_bed' --}}
                    {{-- Removed Floor Cell --}}
                    <td>
                        <span class="badge {{ $room->is_active ? 'bg-success' : 'bg-danger' }}">
                            {{ $room->is_active ? 'Active' : 'Inactive' }}
                        </span>
                    </td>
                    <td>
                        {{-- Add Permission Checks if needed --}}
                        <button wire:click="edit({{ $room->id }})" class="btn btn-icon-text btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#modal" title="Edit">
                            <i class="btn-icon-prepend" data-feather="edit"></i>Edit
                        </button>
                        <button wire:click="delete({{ $room->id }})" onclick="return confirm('Are you sure you want to delete this room?') || event.stopImmediatePropagation()" class="btn btn-icon-text btn-sm btn-outline-danger" title="Delete">
                            <i class="btn-icon-prepend" data-feather="trash-2"></i>Delete
                        </button>
                        <button wire:click="showDetails({{ $room->id }})" class="btn btn-icon-text btn-sm btn-outline-info" data-bs-toggle="modal" data-bs-target="#detailsModal" title="Details">
                            <i class="btn-icon-prepend" data-feather="info"></i>Details
                        </button>
                    </td>
                </tr>
                @empty
                <tr>
                     {{-- Adjusted colspan --}}
                    <td colspan="7" class="text-center">No rooms found.</td>
                </tr>
                @endforelse
            </tbody>
        </table>
    </div>

    @if(!$search && $rooms->hasPages())
        <div class="d-flex justify-content-end">
            {{ $rooms->links() }}
        </div>
    @endif

    <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog" aria-labelledby="detailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="detailsModalLabel">Room Details</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
                </div>
                <div class="modal-body p-4">
                    @if($selected_data)
                    <div class="row g-4">
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Room Number:</strong>
                                <span class="text-primary">{{ $selected_data->room_number }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Room Type:</strong>
                                <span class="text-primary">{{ $selected_data->type }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Total Beds:</strong>
                                <span class="text-primary">{{ $selected_data->total_beds }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Available Beds:</strong>
                                <span class="text-primary">{{ $selected_data->available_beds }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Cost Per Bed:</strong>
                                <span class="text-success">{{ number_format($selected_data->cost_per_bed ?? 0, 2) }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Status:</strong>
                                <span class="badge {{ $selected_data->is_active ? 'bg-success' : 'bg-danger' }}">
                                    {{ $selected_data->is_active ? 'Active' : 'Inactive' }}
                                </span>
                            </div>
                        </div>
                        
                        <!-- Room Occupancy Information -->
                        <div class="col-md-12 mt-3">
                            <h5 class="text-primary">Bed Occupancy Information</h5>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Current Occupancy Rate:</strong>
                                @php
                                    $occupancyRate = $selected_data->total_beds > 0 
                                        ? (($selected_data->total_beds - $selected_data->available_beds) / $selected_data->total_beds) * 100 
                                        : 0;
                                @endphp
                                <span class="text-{{ $occupancyRate > 90 ? 'danger' : ($occupancyRate > 70 ? 'warning' : 'success') }}">
                                    {{ number_format($occupancyRate, 1) }}%
                                </span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Beds Occupied:</strong>
                                <span class="text-primary">{{ $selected_data->total_beds - $selected_data->available_beds }}</span>
                            </div>
                        </div>
                        
                        <!-- Current Bookings Information -->
                        <div class="col-md-12 mt-3">
                            <h5 class="text-primary">Current Active Bookings</h5>
                            @php
                                $activeBookings = App\Models\Reception\RoomBooking::where('room_id', $selected_data->id)
                                    ->where('is_delete', 0)
                                    ->where('status', '!=', 'Cancelled')
                                    ->where('status', '!=', 'Checked-out')
                                    ->where(function($query) {
                                        $query->where('check_out_date', '>=', now())
                                            ->orWhereNull('check_out_date');
                                    })
                                    ->with('patient')
                                    ->limit(5)
                                    ->get();
                            @endphp
                            
                            @if($activeBookings->count() > 0)
                                <div class="table-responsive mt-2">
                                    <table class="table table-bordered table-sm">
                                        <thead>
                                            <tr>
                                                <th>Patient</th>
                                                <th>Check-in Date</th>
                                                <th>Check-out Date</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            @foreach($activeBookings as $booking)
                                            <tr>
                                                <td>{{ $booking->patient?->name ?? 'N/A' }}</td>
                                                <td>{{ \Carbon\Carbon::parse($booking->check_in_date)->format('d-M-Y') }}</td>
                                                <td>{{ $booking->check_out_date ? \Carbon\Carbon::parse($booking->check_out_date)->format('d-M-Y') : 'Not Set' }}</td>
                                                <td><span class="badge bg-info">{{ $booking->status }}</span></td>
                                            </tr>
                                            @endforeach
                                        </tbody>
                                    </table>
                                </div>
                                @if($activeBookings->count() >= 5)
                                    <div class="text-center text-muted small">Showing first 5 bookings</div>
                                @endif
                            @else
                                <div class="alert alert-info mt-2">No active bookings for this room</div>
                            @endif
                        </div>
                        
                        <!-- Financial Information -->
                        <div class="col-md-12 mt-3">
                            <h5 class="text-primary">Financial Information</h5>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Daily Revenue Potential:</strong>
                                <span class="text-success">{{ number_format($selected_data->cost_per_bed * $selected_data->total_beds, 2) }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Monthly Revenue Potential:</strong>
                                <span class="text-success">{{ number_format($selected_data->cost_per_bed * $selected_data->total_beds * 30, 2) }}</span>
                            </div>
                        </div>
                        
                        <!-- System Information -->
                        <div class="col-md-12 mt-3">
                            <h5 class="text-primary">System Information</h5>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Created At:</strong>
                                <span class="text-muted">{{ $selected_data->created_at?->format('Y-m-d H:i:s') ?? 'N/A' }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Updated At:</strong>
                                <span class="text-muted">{{ $selected_data->updated_at?->format('Y-m-d H:i:s') ?? 'N/A' }}</span>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="p-3 rounded border">
                                <strong>Record ID:</strong>
                                <span class="text-muted">{{ $selected_data->id }}</span>
                            </div>
                        </div>
                    </div>
                    @else
                        <div class="alert alert-warning">No room details available.</div>
                    @endif
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" wire:click="closeDetailsModal">Close</button>
                </div>
            </div>
        </div>
    </div>
</div>

<script>
    document.addEventListener('livewire:initialized', () => {
        const modalEl = document.getElementById('modal');
        const modal = new bootstrap.Modal(modalEl);
        const detailsModalEl = document.getElementById('detailsModal');
        const detailsModal = new bootstrap.Modal(detailsModalEl);

        window.addEventListener('open-modal', event => {
            let targetModal = modal; // Default to main modal
            if (event.detail.length && event.detail[0] === 'detailsModal') {
                targetModal = detailsModal;
            }
             // Only open #modal if no specific target OR target is #modal
             // Only open #detailsModal if target is #detailsModal
            if ((!event.detail.length || event.detail[0] === 'modal') && targetModal === modal) {
                 modal.show();
            } else if (event.detail.length && event.detail[0] === 'detailsModal' && targetModal === detailsModal) {
                 detailsModal.show();
            }
        });

        window.addEventListener('close-modal', event => {
            if (!event.detail.length || event.detail[0] === 'modal') {
                modal.hide();
            }
            if (event.detail.length && event.detail[0] === 'detailsModal') {
                detailsModal.hide();
            }
        });

         window.addEventListener('save-modal', event => {
            if (!event.detail.length || event.detail[0] === 'modal') {
                modal.hide();
            }
        });

        modalEl.addEventListener('shown.bs.modal', () => { feather.replace(); });
        detailsModalEl.addEventListener('shown.bs.modal', () => { feather.replace(); });
    });
</script>