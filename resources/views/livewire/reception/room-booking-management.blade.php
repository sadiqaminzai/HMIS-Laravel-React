@php 
use Carbon\Carbon;
use App\Models\RoomBooking; // Ensure you have the correct model imported
@endphp
<div>
    <div class="page-header p-8 mb-4 border rounded ">
        <div class="row align-items-center">
            <div class="col-lg-8 col-md-8">
                <div class="page-header-title d-flex align-items-center">
                    <i class="ik ik-calendar bg-blue p-3 rounded text-white mr-3"></i>
                    <div class="d-inline">
                        <h5>Manage patient room reservations</h5>
                    </div>
                </div>
            </div>
            <div class="col-lg-4 col-md-4">
                <div class="d-flex justify-content-end align-items-center h-100">
                    {{-- Standardized Add Button --}}
                    <button type="button" class="btn btn-success mr-2" wire:click="create" data-bs-toggle="modal" data-bs-target="#modal" wire:ignore>
                        <i class="ik ik-plus"></i> New Booking
                    </button>
                     {{-- Keep Advanced Search Button --}}
                    <button type="button" class="btn btn-primary" data-bs-toggle="modal" data-bs-target="#searchModal" wire:ignore>
                        <i class="ik ik-search"></i> Advanced Search
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div class="card">
        <div class="card-header d-flex justify-content-between align-items-center">
            <h3>Bookings List</h3>
            <div class="d-flex">
                <div class="input-group mr-2" style="width: 250px;">
                    <input type="text" class="form-control" placeholder="Search..." wire:model.live="search">
                    <span class="input-group-text"><i class="ik ik-search"></i></span>
                </div>
                {{-- Keep Export Dropdown --}}
                <div class="dropdown">
                    <button class="btn btn-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                        <i class="ik ik-download"></i> Export
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li><a class="dropdown-item" href="#" wire:click.prevent="pdf"><i class="ik ik-file-text"></i> PDF</a></li>
                        <li><a class="dropdown-item" href="#" wire:click.prevent="excel"><i class="ik ik-file"></i> Excel</a></li>
                        <li><a class="dropdown-item" href="#" wire:click.prevent="print"><i class="ik ik-printer"></i> Print</a></li>
                    </ul>
                </div>
            </div>
        </div>
        <div class="card-body">
            <div class="table-responsive">
                <table class="table table-hover">
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Patient</th>
                            <th>Room</th>
                            <th>Doctor</th>
                            <th>Check-in/out</th>
                            <th>Total Cost</th>
                            <th>Discount Amount</th>
                            <th>Status</th>
                            <th>Payment</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse($bookings as $booking)
                            <tr>
                                <td>{{ $booking->id }}</td>
                                <td>{{ $booking->patient?->name ?? 'N/A' }} <small class="text-muted d-block">{{ $booking->patient?->mr_no }}</small></td>
                                <td>{{ $booking->room?->room_number ?? 'N/A' }} <small class="text-muted d-block">{{ $booking->room?->type }}</small></td>
                                <td>{{ $booking->doctor ? $booking->doctor->first_name . ' ' . $booking->doctor->last_name : 'N/A' }}</td>
                                <td>{{ $booking->check_in_date ? Carbon::parse($booking->check_in_date)->format('d-M-Y') : 'N/A' }} / {{ $booking->check_out_date ? Carbon::parse($booking->check_out_date)->format('d-M-Y') : 'N/A' }}</td>
                                <td>{{ $booking->total_cost ?? 'N/A' }}</td>
                                <td>{{ $booking->discount_amount ?? '0' }}</td>
                                <td>
                                    {{-- Status Badge --}}
                                    @php
                                        $statusClass = match(strtolower($booking->status ?? '')) {
                                            'confirmed' => 'badge-success',
                                            'pending' => 'badge-warning',
                                            'cancelled' => 'badge-danger',
                                            'checked-in' => 'badge-info',
                                            'checked-out' => 'badge-secondary',
                                            default => 'badge-light',
                                        };
                                    @endphp
                                    <span class="badge {{ $statusClass }}">{{ $booking->status ?? 'N/A' }}</span>
                                </td>
                                <td>
                                    {{-- Payment Status Badge --}}
                                    @php
                                        $paymentStatusClass = match(strtolower($booking->payment_status ?? 'pending')) {
                                            'paid' => 'badge-success',
                                            'partial' => 'badge-info',
                                            'cancelled' => 'badge-danger',
                                            default => 'badge-warning',
                                        };
                                    @endphp
                                    <span class="badge {{ $paymentStatusClass }}">{{ ucfirst($booking->payment_status ?? 'pending') }}</span>
                                </td>
                                <td>
                                    <div class="table-actions btn-group btn-group-sm" role="group">
                                        <button wire:click="showDetails({{ $booking->id }})" class="btn btn-icon-text btn-sm btn-outline-info" data-bs-toggle="modal" data-bs-target="#detailsModal" title="Details">
                                            <i class="btn-icon-prepend" data-feather="info"></i>Details
                                        </button>
                                        <button wire:click="edit({{ $booking->id }})" class="btn btn-icon-text btn-sm btn-outline-primary" data-bs-toggle="modal" data-bs-target="#modal" title="Edit">
                                            <i class="btn-icon-prepend" data-feather="edit"></i>Edit
                                        </button>
                                        <button wire:click="togglePaymentStatus({{ $booking->id }})" class="btn btn-icon-text btn-sm {{ ($booking->payment_status ?? 'pending') === 'pending' ? 'btn-outline-success' : 'btn-outline-warning' }}" title="{{ ($booking->payment_status ?? 'pending') === 'pending' ? 'Mark as Paid' : 'Mark as Pending' }}">
                                            <i class="btn-icon-prepend" data-feather="{{ ($booking->payment_status ?? 'pending') === 'pending' ? 'dollar-sign' : 'credit-card' }}"></i>Pay
                                        </button>
                                        <button wire:click="delete({{ $booking->id }})" onclick="return confirm('Are you sure you want to delete this booking?') || event.stopImmediatePropagation()" class="btn btn-icon-text btn-sm btn-outline-danger" title="Delete">
                                            <i class="btn-icon-prepend" data-feather="trash-2"></i>Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        @empty
                            <tr>
                                <td colspan="9" class="text-center">No bookings found.</td>
                            </tr>
                        @endforelse
                    </tbody>
                </table>
            </div>
             {{-- Ensure pagination links render correctly --}}
            @if ($bookings instanceof \Illuminate\Pagination\LengthAwarePaginator && $bookings->hasPages())
                <div class="d-flex justify-content-center mt-3">
                    {{ $bookings->links() }}
                </div>
            @endif
        </div>
    </div>

    {{-- -------------------- MODALS -------------------- --}}

    <div wire:ignore.self class="modal fade" id="modal" tabindex="-1" role="dialog" aria-labelledby="modalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="modalLabel">{{ $id ? 'Edit Room Booking' : 'Create Room Booking' }}</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeModal()"></button>
                </div>
                <div class="modal-body">
                    {{-- Row 1: Patient & Room --}}
                    <div class="row mb-3">
                        <div class="col-md-6 form-group">
                            <label for="patient_id">Patient <span class="text-danger">*</span></label>
                            <select wire:model="patient_id" id="patient_id" class="form-control @error('patient_id') is-invalid @enderror">
                                <option value="">-- Select Patient --</option>
                                @foreach($patients ?? [] as $patient)
                                <option value="{{ $patient->id }}">{{ $patient->name }} ({{ $patient->mr_no }})</option>
                                @endforeach
                            </select>
                            @error('patient_id') <span class="invalid-feedback">{{ $message }}</span> @enderror
                        </div>
                        <div class="col-md-6 form-group">
                            <label for="room_id">Room <span class="text-danger">*</span></label>
                            <select wire:model="room_id" id="room_id" class="form-control @error('room_id') is-invalid @enderror">
                                <option value="">-- Select Room --</option>
                                @foreach($rooms ?? [] as $room)
                                <option value="{{ $room->id }}">{{ $room->room_number }} ({{ $room->type }})</option>
                                @endforeach
                            </select>
                            @error('room_id') <span class="invalid-feedback">{{ $message }}</span> @enderror
                        </div>
                    </div>

                     {{-- Row 2: Doctor & Booking Date --}}
                    <div class="row mb-3">
                         <div class="col-md-6 form-group">
                            <label for="doctor_id">Referring Doctor</label>
                            <select wire:model="doctor_id" id="doctor_id" class="form-control @error('doctor_id') is-invalid @enderror">
                                <option value="">-- Optional: Select Doctor --</option>
                                @foreach($doctors ?? [] as $doctor)
                                <option value="{{ $doctor->id }}">{{ $doctor->first_name }} {{ $doctor->last_name }}</option>
                                @endforeach
                            </select>
                            @error('doctor_id') <span class="invalid-feedback">{{ $message }}</span> @enderror
                        </div>
                         <div class="col-md-6 form-group">
                            <label for="booking_date">Booking Date <span class="text-danger">*</span></label>
                            <input type="date" wire:model="booking_date" id="booking_date" class="form-control @error('booking_date') is-invalid @enderror">
                            @error('booking_date') <span class="invalid-feedback">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    {{-- Row 3: Check-in & Check-out --}}
                    <div class="row mb-3">
                        <div class="col-md-6 form-group">
                            <label for="check_in_date">Check-in Date <span class="text-danger">*</span></label>
                            <input type="date" wire:model="check_in_date" id="check_in_date" class="form-control @error('check_in_date') is-invalid @enderror">
                            @error('check_in_date') <span class="invalid-feedback">{{ $message }}</span> @enderror
                        </div>
                        <div class="col-md-6 form-group">
                            <label for="check_out_date">Check-out Date</label>
                            <input type="date" wire:model="check_out_date" id="check_out_date" class="form-control @error('check_out_date') is-invalid @enderror">
                            @error('check_out_date') <span class="invalid-feedback">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    {{-- Row: Bed Information --}}
                    <div class="row mb-3">
                        <div class="col-md-6 form-group">
                            <label for="bed_number">Starting Bed Number <span class="text-danger">*</span></label>
                            <input type="number" wire:model="bed_number" id="bed_number" class="form-control @error('bed_number') is-invalid @enderror" min="1">
                            @error('bed_number') <span class="invalid-feedback">{{ $message }}</span> @enderror
                        </div>
                        
                        <div class="col-md-6 form-group">
                            <label for="beds_to_book">Number of Beds to Book <span class="text-danger">*</span></label>
                            <input type="number" wire:model="beds_to_book" id="beds_to_book" class="form-control @error('beds_to_book') is-invalid @enderror" min="1" wire:change="calculateTotalCost">
                            @error('beds_to_book') <span class="invalid-feedback">{{ $message }}</span> @enderror
                        </div>
                    </div>

                    {{-- Discount toggle --}}
                    <div class="row mb-3">
                        <div class="col-md-6 form-group">
                            <label class="d-block">Discount</label>
                            <div class="form-check form-switch mt-2">
                                <input class="form-check-input" type="checkbox" wire:model="discount" wire:change="applyDiscount" id="discount">
                                <label class="form-check-label" for="discount">Apply discount</label>
                            </div>
                        </div>
                    </div>

                    {{-- Row: Discount details (only shown when discount is enabled) --}}
                    <div class="row mb-3" x-data="{}" x-show="$wire.discount">
                        <div class="col-md-6 form-group">
                            <label for="discount_percentage">Discount Percentage (%)</label>
                            <input type="number" wire:model="discount_percentage" wire:change="applyDiscount" id="discount_percentage" class="form-control" min="0" max="100">
                        </div>
                        <div class="col-md-6 form-group">
                            <label for="discount_amount">Discount Amount</label>
                            <input type="number" wire:model="discount_amount" wire:change="applyDiscount" id="discount_amount" class="form-control" min="0" step="0.01">
                        </div>
                    </div>

                    {{-- Row: Total Cost --}}
                    <div class="row mb-3">
                        <div class="col-md-12 form-group">
                            <label for="total_cost">Total Cost <span class="text-danger">*</span></label>
                            <input type="number" wire:model="total_cost" id="total_cost" class="form-control @error('total_cost') is-invalid @enderror" step="0.01" readonly>
                            @error('total_cost') <span class="invalid-feedback">{{ $message }}</span> @enderror
                        </div>
                    </div>

                     {{-- Row 4: Status & Remarks --}}
                     <div class="row mb-3">
                        <div class="col-md-6 form-group">
                             <label for="status">Status <span class="text-danger">*</span></label>
                             <select wire:model="status" id="status" class="form-control @error('status') is-invalid @enderror">
                                 <option value="Pending">Pending</option>
                                 <option value="Confirmed">Confirmed</option>
                                 <option value="Checked-in">Checked-in</option>
                                 <option value="Checked-out">Checked-out</option>
                                 <option value="Cancelled">Cancelled</option>
                             </select>
                             @error('status') <span class="invalid-feedback">{{ $message }}</span> @enderror
                         </div>
                          <div class="col-md-6 form-group">
                             {{-- Optional: Add is_active field if used --}}
                            {{-- <label for="is_active">Is Active</label>
                            <select wire:model="is_active" id="is_active" class="form-control">
                                <option value="1">Yes</option>
                                <option value="0">No</option>
                            </select> --}}
                         </div>
                    </div>

                     <div class="row mb-3">
                         <div class="col-md-12 form-group">
                            <label for="remarks">Remarks</label>
                            <textarea wire:model="remarks" id="remarks" rows="3" class="form-control @error('remarks') is-invalid @enderror" placeholder="Any additional notes..."></textarea>
                            @error('remarks') <span class="invalid-feedback">{{ $message }}</span> @enderror
                        </div>
                     </div>

                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" wire:click="closeModal()">Cancel</button>
                    <button type="button" wire:click="{{ $id ? 'update' : 'add' }}" class="btn btn-primary">
                        {{ $id ? 'Update Booking' : 'Save Booking' }}
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div wire:ignore.self class="modal fade" id="detailsModal" tabindex="-1" role="dialog" aria-labelledby="detailsModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="detailsModalLabel">Booking Details (ID: {{ $selected_data?->id }})</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeDetailsModal"></button>
                </div>
                <div class="modal-body p-4">
                    @if($selected_data)
                    <div class="row g-3">
                        {{-- Booking Info --}}
                        <div class="col-md-12 mt-2"><h5 class="text-primary border-bottom pb-2">Booking Details</h5></div>
                        <div class="col-md-4"><div class="p-2 border rounded"><strong>Booking ID:</strong> <span class="text-primary">#{{ $selected_data->id }}</span></div></div>
                        <div class="col-md-4"><div class="p-2 border rounded"><strong>Status:</strong> <span class="badge {{ match(strtolower($selected_data->status ?? '')) {
                            'confirmed' => 'bg-success',
                            'pending' => 'bg-warning',
                            'cancelled' => 'bg-danger',
                            'checked-in' => 'bg-info',
                            'checked-out' => 'bg-secondary',
                            default => 'bg-light',
                        } }}">{{ $selected_data->status ?? 'N/A' }}</span></div></div>
                        <div class="col-md-4"><div class="p-2 border rounded"><strong>Booking Date:</strong> <span class="text-primary">{{ $selected_data->booking_date ? Carbon::parse($selected_data->booking_date)->format('d-M-Y') : 'N/A' }}</span></div></div>
                        <div class="col-md-4"><div class="p-2 border rounded"><strong>Check-in Date:</strong> <span class="text-primary">{{ $selected_data->check_in_date ? Carbon::parse($selected_data->check_in_date)->format('d-M-Y') : 'N/A' }}</span></div></div>
                        <div class="col-md-4"><div class="p-2 border rounded"><strong>Check-out Date:</strong> <span class="text-primary">{{ $selected_data->check_out_date ? Carbon::parse($selected_data->check_out_date)->format('d-M-Y') : 'N/A' }}</span></div></div>
                        <div class="col-md-4"><div class="p-2 border rounded"><strong>Duration:</strong> <span class="text-primary">
                            @php
                                $checkIn = $selected_data->check_in_date ? Carbon::parse($selected_data->check_in_date) : null;
                                $checkOut = $selected_data->check_out_date ? Carbon::parse($selected_data->check_out_date) : null;
                                $days = ($checkIn && $checkOut) ? $checkOut->diffInDays($checkIn) : 'N/A';
                                echo $days === 'N/A' ? 'N/A' : $days . ' ' . ($days == 1 ? 'day' : 'days');
                            @endphp
                        </span></div></div>

                        {{-- Room & Bed Info --}}
                        <div class="col-md-12 mt-3"><h5 class="text-primary border-bottom pb-2">Room & Bed Information</h5></div>
                        <div class="col-md-4"><div class="p-2 border rounded"><strong>Room Number:</strong> <span class="text-primary">{{ $selected_data->room->room_number ?? 'N/A' }}</span></div></div>
                        <div class="col-md-4"><div class="p-2 border rounded"><strong>Room Type:</strong> <span class="text-primary">{{ $selected_data->room->type ?? 'N/A' }}</span></div></div>
                        <div class="col-md-4"><div class="p-2 border rounded"><strong>Bed Number:</strong> <span class="text-primary">{{ $selected_data->bed_number ?? 'N/A' }}</span></div></div>
                        <div class="col-md-4"><div class="p-2 border rounded"><strong>Beds Booked:</strong> <span class="text-primary">{{ $selected_data->beds_to_book ?? '1' }}</span></div></div>
                        
                        {{-- Cost & Payment Info --}}
                        <div class="col-md-12 mt-3"><h5 class="text-primary border-bottom pb-2">Cost Details</h5></div>
                        <div class="col-md-4"><div class="p-2 border rounded"><strong>Cost Per Bed:</strong> <span class="text-success">{{ number_format($selected_data->room->cost_per_bed ?? 0, 2) }}</span></div></div>
                        <div class="col-md-4"><div class="p-2 border rounded"><strong>Total Base Cost:</strong> <span class="text-success">
                            @php
                                $baseCost = ($selected_data->total_cost ?? 0) + ($selected_data->discount_amount ?? 0);
                                echo number_format($baseCost, 2);
                            @endphp
                        </span></div></div>
                        <div class="col-md-4"><div class="p-2 border rounded"><strong>Discount Amount:</strong> <span class="text-danger">{{ number_format($selected_data->discount_amount ?? 0, 2) }}</span></div></div>
                        <div class="col-md-4"><div class="p-2 border rounded"><strong>Final Cost:</strong> <span class="text-success fw-bold">{{ number_format($selected_data->total_cost ?? 0, 2) }}</span></div></div>
                        <div class="col-md-4"><div class="p-2 border rounded"><strong>Discount Rate:</strong> <span class="text-danger">
                            @php
                                $baseCost = ($selected_data->total_cost ?? 0) + ($selected_data->discount_amount ?? 0);
                                $discountRate = $baseCost > 0 ? (($selected_data->discount_amount ?? 0) / $baseCost) * 100 : 0;
                                echo number_format($discountRate, 1) . '%';
                            @endphp
                        </span></div></div>
                        <div class="col-md-4"><div class="p-2 border rounded"><strong>Daily Rate:</strong> <span class="text-success">
                            @php
                                $days = ($checkIn && $checkOut) ? max(1, $checkOut->diffInDays($checkIn)) : 1;
                                $dailyRate = ($selected_data->total_cost ?? 0) / $days;
                                echo number_format($dailyRate, 2) . '/day';
                            @endphp
                        </span></div></div>

                        {{-- Patient Info --}}
                        <div class="col-md-12 mt-3"><h5 class="text-primary border-bottom pb-2">Patient Information</h5></div>
                        <div class="col-md-4"><div class="p-2 border rounded"><strong>Name:</strong> <span class="text-primary">{{ $selected_data->patient->name ?? 'N/A' }}</span></div></div>
                        <div class="col-md-4"><div class="p-2 border rounded"><strong>Phone:</strong> <span class="text-primary">{{ $selected_data->patient->mobile ?? 'N/A' }}</span></div></div>
                        <div class="col-md-4"><div class="p-2 border rounded"><strong>Age:</strong> <span class="text-primary">{{ $selected_data->patient->age ?? 'N/A' }}</span></div></div>
                        <div class="col-md-8"><div class="p-2 border rounded"><strong>Address:</strong> <span class="text-primary">{{ $selected_data->patient->address ?? 'N/A' }}</span></div></div>
                        
                        {{-- Doctor Info (Optional) --}}
                         @if($selected_data->doctor)
                            <div class="col-md-12 mt-3"><h5 class="text-primary border-bottom pb-2">Referring Doctor</h5></div>
                            <div class="col-md-4"><div class="p-2 border rounded"><strong>Name:</strong> <span class="text-primary">{{ $selected_data->doctor->first_name }} {{ $selected_data->doctor->last_name }}</span></div></div>
                            <div class="col-md-4"><div class="p-2 border rounded"><strong>Department:</strong> <span class="text-primary">{{ $selected_data->doctor->department->name ?? 'N/A' }}</span></div></div>
                            <div class="col-md-4"><div class="p-2 border rounded"><strong>Specialty:</strong> <span class="text-primary">{{ $selected_data->doctor->specialty ?? 'N/A' }}</span></div></div>
                         @endif

                         {{-- Remarks --}}
                         @if($selected_data->remarks)
                            <div class="col-md-12 mt-3"><h5 class="text-primary border-bottom pb-2">Remarks</h5></div>
                            <div class="col-12"><div class="p-2 border rounded"><p class="mb-0">{{ $selected_data->remarks }}</p></div></div>
                         @endif

                         {{-- Audit Info --}}
                         <div class="col-md-12 mt-3"><h5 class="text-primary border-bottom pb-2">Audit Information</h5></div>
                         <div class="col-md-4"><div class="p-2 border rounded"><strong>Created By:</strong> <span class="text-muted">{{ $selected_data->user->name ?? 'N/A' }}</span></div></div>
                         <div class="col-md-4"><div class="p-2 border rounded"><strong>Created At:</strong> <span class="text-muted">{{ $selected_data->created_at?->format('d-M-Y H:i') ?? 'N/A' }}</span></div></div>
                         <div class="col-md-4"><div class="p-2 border rounded"><strong>Updated By:</strong> <span class="text-muted">{{ $selected_data->updater->name ?? 'N/A' }}</span></div></div>
                         <div class="col-md-4"><div class="p-2 border rounded"><strong>Updated At:</strong> <span class="text-muted">{{ $selected_data->updated_at?->format('d-M-Y H:i') ?? 'N/A' }}</span></div></div>
                         <div class="col-md-4"><div class="p-2 border rounded"><strong>Record ID:</strong> <span class="text-muted">{{ $selected_data->id }}</span></div></div>
                    </div>
                    @else
                        <p>No booking details available.</p>
                    @endif
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" wire:click="closeDetailsModal">Close</button>
                </div>
            </div>
        </div>
    </div>

    <div wire:ignore.self class="modal fade" id="searchModal" tabindex="-1" role="dialog" aria-labelledby="searchModalLabel" aria-hidden="true">
        <div class="modal-dialog modal-lg" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title" id="searchModalLabel">Advanced Search</h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close" wire:click="closeSearchModal"></button>
                </div>
                <div class="modal-body">
                     {{-- Row 1 --}}
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <label for="searchById">Booking ID</label>
                            <input type="number" class="form-control" id="searchById" wire:model.defer="searchById" placeholder="Enter Booking ID">
                        </div>
                         <div class="col-md-6">
                            <label for="searchByPatient">Patient Name/MRN</label>
                            <input type="text" class="form-control" id="searchByPatient" wire:model.defer="searchByPatient" placeholder="Enter Patient Name or MRN">
                        </div>
                    </div>
                     {{-- Row 2 --}}
                    <div class="row mb-3">
                       <div class="col-md-6">
                            <label for="searchByRoom">Room Number</label>
                            <input type="text" class="form-control" id="searchByRoom" wire:model.defer="searchByRoom" placeholder="Enter Room Number">
                        </div>
                        <div class="col-md-6">
                            <label for="searchByStatus">Status</label>
                            <select class="form-control" id="searchByStatus" wire:model.defer="searchByStatus">
                                <option value="">All Statuses</option>
                                <option value="Pending">Pending</option>
                                <option value="Confirmed">Confirmed</option>
                                <option value="Checked-in">Checked-in</option>
                                <option value="Checked-out">Checked-out</option>
                                <option value="Cancelled">Cancelled</option>
                            </select>
                        </div>
                    </div>
                    {{-- Row 3: Date Range --}}
                    <div class="row mb-3 align-items-end">
                        <div class="col-md-5">
                            <label>Booking Date From</label>
                             <input type="date" class="form-control" wire:model.defer="searchFromDate">
                        </div>
                         <div class="col-md-5">
                             <label>Booking Date To</label>
                            <input type="date" class="form-control" wire:model.defer="searchToDate">
                        </div>
                         <div class="col-md-2">
                             {{-- Optional: Clear Date Button --}}
                             <button type="button" class="btn btn-sm btn-outline-secondary w-100" wire:click="$set('searchFromDate', ''); $set('searchToDate', '')">Clear Dates</button>
                         </div>
                    </div>
                     {{-- Row 4: ID Range --}}
                    <div class="row mb-3 align-items-end">
                       <div class="col-md-5">
                           <label for="searchFromId">Booking ID From</label>
                           <input type="number" class="form-control" id="searchFromId" wire:model.defer="searchFromId" placeholder="Start ID">
                       </div>
                       <div class="col-md-5">
                           <label for="searchToId">Booking ID To</label>
                           <input type="number" class="form-control" id="searchToId" wire:model.defer="searchToId" placeholder="End ID">
                       </div>
                        <div class="col-md-2">
                             {{-- Optional: Clear ID Button --}}
                            <button type="button" class="btn btn-sm btn-outline-secondary w-100" wire:click="$set('searchFromId', ''); $set('searchToId', '')">Clear IDs</button>
                        </div>
                    </div>

                     {{-- Display Search Results within modal --}}
                     @if(!empty($searchResults))
                     <hr>
                     <h5>Search Results ({{ count($searchResults) }})</h5>
                     <div style="max-height: 300px; overflow-y: auto;">
                         <ul class="list-group list-group-flush">
                             @foreach($searchResults as $result)
                             <li class="list-group-item d-flex justify-content-between align-items-center">
                                 <span>
                                     #{{ $result->id }} - {{ $result->patient?->name }} ({{ $result->room?->room_number }})
                                     <small class="d-block text-muted">{{ $result->status }} | {{ Carbon::parse($result->booking_date)->format('d M Y') }}</small>
                                 </span>
                                 {{-- Optional: Add view/edit buttons for search results --}}
                                 {{-- <button class="btn btn-sm btn-outline-primary" wire:click="edit({{ $result->id }})" data-bs-dismiss="modal">Edit</button> --}}
                             </li>
                             @endforeach
                         </ul>
                     </div>
                     @endif

                </div>
                <div class="modal-footer justify-content-between">
                     <button type="button" class="btn btn-warning" wire:click="resetFilters">Reset Filters</button>
                    <div>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal" wire:click="closeSearchModal">Close</button>
                        <button type="button" class="btn btn-primary" wire:click="searchDetails">
                            <span wire:loading wire:target="searchDetails" class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                             Search
                         </button>
                    </div>
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
        const searchModalEl = document.getElementById('searchModal'); // Added Search Modal
        const searchModal = new bootstrap.Modal(searchModalEl);

        window.addEventListener('open-modal', event => {
            let targetId = 'modal'; // Default
            if (event.detail.length && typeof event.detail[0] === 'string') {
                 targetId = event.detail[0];
            }

            if (targetId === 'modal') modal.show();
            else if (targetId === 'detailsModal') detailsModal.show();
            else if (targetId === 'searchModal') searchModal.show(); // Handle search modal
        });

        window.addEventListener('close-modal', event => {
            let targetId = 'modal'; // Default
            if (event.detail.length && typeof event.detail[0] === 'string') {
                 targetId = event.detail[0];
            }

            if (targetId === 'modal') modal.hide();
            else if (targetId === 'detailsModal') detailsModal.hide();
            else if (targetId === 'searchModal') searchModal.hide(); // Handle search modal
        });

         window.addEventListener('save-modal', event => { // Used to close #modal after save/update
             if (!event.detail.length || event.detail[0] === 'modal') {
                 modal.hide();
             }
        });

         // Optional: Re-initialize feather icons if needed
         // modalEl.addEventListener('shown.bs.modal', () => { feather.replace(); });
         // detailsModalEl.addEventListener('shown.bs.modal', () => { feather.replace(); });
         // searchModalEl.addEventListener('shown.bs.modal', () => { feather.replace(); }); // Add if icons used in search modal
    });
</script>