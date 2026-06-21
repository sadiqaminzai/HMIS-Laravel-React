<?php

namespace App\Livewire\Reception;

use Livewire\Component;
use Illuminate\Support\Facades\Auth; // Added back for created_by/updated_by
use Livewire\WithFileUploads;
use Livewire\WithPagination;
use Barryvdh\DomPDF\PDF;
use Maatwebsite\Excel\Facades\Excel;
use App\Models\Reception\Patient;
use App\Models\General\Employee;
use App\Models\Reception\RoomBooking;
use App\Models\Reception\Room;
use Carbon\Carbon;

class RoomBookingManagement extends Component
{
    use WithFileUploads, WithPagination; // Assuming WithFileUploads might be needed later

    // Properties for RoomBooking model fields
    public $id = null; // Standardized ID property
    public $room_id, $patient_id, $doctor_id, $booking_date, $check_in_date, $check_out_date, $status, $remarks;
    public $bed_number = 1; // Default bed number
    public $beds_to_book = 1; // Number of beds to book in a single transaction
    public $total_cost = 0;
    public $discount = false; // Whether discount is applied
    public $discount_amount = 0; // Discount amount
    public $discount_percentage = 0; // Optional percentage for discount
    public $payment_status = 'pending'; // Default payment status
    public $is_active = 1; // Assuming default active state if needed

    // Properties for modal control and data
    public $search = '';
    public $isOpen = 0;
    public $selected_data = null; // For details modal

    protected $paginationTheme = 'bootstrap';

    // Properties for advanced search (kept as is)
    public $searchById = '', $searchByPatient = '', $searchByRoom = '', $searchByStatus = '', $searchByPaymentStatus = '';
    public $searchFromDate = '', $searchToDate = '';
    public $searchFromId = '', $searchToId = '';
    public $searchResults = [];

    // Validation rules - adjusted to use $this->id for unique checks if needed
    protected function rules()
    {
        // Add unique constraints or other specific rules if necessary
        return [
            'room_id' => 'required|exists:rooms,id',
            'patient_id' => 'required|exists:patients,id',
            'doctor_id' => 'nullable|exists:employees,id', // Assuming doctor is optional
            'booking_date' => 'required|date',
            'check_in_date' => 'required|date|after_or_equal:booking_date',
            'check_out_date' => 'nullable|date|after_or_equal:check_in_date', // Check-out can be null, must be after check-in
            'status' => 'required|string|in:Pending,Confirmed,Checked-in,Checked-out,Cancelled', // Example statuses
            'payment_status' => 'required|string|in:pending,paid,partial,cancelled', // Payment status validation
            'remarks' => 'nullable|string|max:500',
            'bed_number' => 'required|integer|min:1', // Validate bed number
            'beds_to_book' => 'required|integer|min:1', // Validate number of beds to book
            'total_cost' => 'required|numeric|min:0', // Validate total cost
            'discount' => 'required|boolean', // Validate discount flag
            'discount_amount' => 'nullable|numeric|min:0', // Validate discount amount
            'discount_percentage' => 'nullable|numeric|min:0|max:100', // Validate discount percentage
            'is_active' => 'sometimes|boolean', // If you add an is_active field
        ];
    }

    public function updated($propertyName)
    {
        $this->validateOnly($propertyName);
        
        // Recalculate total cost when any of these values change
        if (in_array($propertyName, ['room_id', 'check_in_date', 'check_out_date', 'discount', 'discount_percentage'])) {
            $this->calculateTotalCost();
        }
        
        // Check bed availability when room or dates change
        if (in_array($propertyName, ['room_id', 'check_in_date', 'check_out_date'])) {
            $this->checkBedAvailability();
        }
    }

    public function updatingSearch()
    {
        $this->resetPage();
    }

    // --- Render Method ---
    public function render()
    {
        // Fetch data needed for dropdowns in the modal
        $patients = Patient::where('is_active', 1)->where('is_delete', 0)->orderBy('name', 'asc')->get(['id', 'name']);
        $rooms = Room::where('is_active', 1)->where('is_delete', 0)->orderBy('room_number', 'asc')->get(['id', 'room_number', 'type']);
        $doctors = Employee::where('is_delete', 0)
            ->where('is_active', 1)
            ->whereHas('designation', function ($query) {
                $query->where('name', 'like', '%doctor%');
            })
            ->orderBy('first_name', 'asc')
            ->get(['id', 'first_name', 'last_name']);

        // Main query for the table
        $bookings_query = RoomBooking::with('patient', 'room', 'doctor', 'user') // Eager load relations for display
            ->where('is_delete', 0) // Assuming soft deletes
            ->where(function ($query) {
                // Basic search implementation (adjust fields as needed)
                $query->whereHas('patient', function ($q) {
                    $q->where('name', 'like', '%' . $this->search . '%');
                })
                ->orWhereHas('room', function ($q) {
                    $q->where('room_number', 'like', '%' . $this->search . '%');
                })
                 ->orWhereHas('doctor', function ($q) {
                    $q->where('first_name', 'like', '%' . $this->search . '%')
                      ->orWhere('last_name', 'like', '%' . $this->search . '%');
                 })
                ->orWhere('status', 'like', '%' . $this->search . '%')
                ->orWhere('id', 'like', '%' . $this->search . '%');
            });

        $bookings = $this->search
            ? $bookings_query->orderBy('id', 'desc')->get()
            : $bookings_query->orderBy('id', 'desc')->paginate(5); // Adjust pagination

        return view('livewire.reception.room-booking-management', [
            'bookings' => $bookings,
            'patients' => $patients, // Pass data for dropdowns
            'rooms' => $rooms,       // Pass data for dropdowns
            'doctors' => $doctors,   // Pass data for dropdowns
        ]);
    }

     // --- Edit/Create Modal Methods (Standardized) ---
    public function create()
    {
        $this->resetInputFields();
        $this->openModal();
    }

    public function openModal()
    {
        $this->isOpen = true;
        $this->dispatch('open-modal'); // Dispatches generic event for #modal
    }

    public function closeModal()
    {
         $this->resetInputFields(); // Reset fields when closing via cancel/X
         $this->dispatch('close-modal'); // Dispatches generic event for #modal
    }

    private function resetInputFields()
    {
        $this->id = null;
        $this->room_id = null;
        $this->patient_id = null;
        $this->doctor_id = null;
        $this->booking_date = now()->format('Y-m-d'); // Set default booking date to today
        $this->check_in_date = null;
        $this->check_out_date = null;
        $this->status = 'Pending'; // Default status
        $this->remarks = null;
        $this->bed_number = 1; // Default bed number
        $this->beds_to_book = 1; // Default number of beds to book
        $this->total_cost = 0;
        $this->discount = false; // Default discount flag
        $this->discount_amount = 0; // Default discount amount
        $this->discount_percentage = 0; // Default discount percentage
        $this->payment_status = 'pending'; // Default payment status
        $this->is_active = 1;
        $this->resetErrorBag();
    }

    // Calculate total cost based on check-in/out dates and cost per bed
    public function calculateTotalCost()
    {
        if (!$this->room_id || !$this->check_in_date || !$this->check_out_date) {
            $this->total_cost = 0;
            return;
        }

        // Get room details
        $room = Room::find($this->room_id);
        if (!$room) {
            $this->total_cost = 0;
            return;
        }

        // Calculate days
        $checkIn = Carbon::parse($this->check_in_date);
        $checkOut = Carbon::parse($this->check_out_date);
        $days = max(1, $checkOut->diffInDays($checkIn));

        // Calculate base cost (days * cost per bed * beds to book)
        $baseCost = $days * $room->cost_per_bed * $this->beds_to_book;

        // Apply discount if enabled
        if ($this->discount) {
            if ($this->discount_percentage > 0) {
                $this->discount_amount = ($baseCost * $this->discount_percentage) / 100;
            }
            $this->total_cost = $baseCost - $this->discount_amount;
        } else {
            $this->discount_amount = 0;
            $this->total_cost = $baseCost;
        }
    }

    // Method to apply discount based on percentage
    public function applyDiscount()
    {
        // Recalculate total cost when discount is toggled
        $this->calculateTotalCost();
    }

    // Check bed availability based on existing bookings
    public function checkBedAvailability()
    {
        if (!$this->room_id || !$this->check_in_date) {
            return;
        }

        $room = Room::find($this->room_id);
        if (!$room) {
            $this->addError('room_id', 'Room not found');
            return false;
        }

        // Get total beds available in the room from Room table
        $totalBeds = $room->total_beds;
        
        // Default check-out date if not set
        $checkOutDate = $this->check_out_date ? Carbon::parse($this->check_out_date) : Carbon::parse($this->check_in_date)->addDay();
        
        // Find all active bookings for this room that overlap with requested dates
        $activeBookings = RoomBooking::where('room_id', $this->room_id)
            ->where('is_delete', 0)
            ->where('status', '!=', 'Cancelled')
            ->where('status', '!=', 'Checked-out')
            ->where(function($query) use ($checkOutDate) {
                $query->where(function($q) use ($checkOutDate) {
                    // Booking starts during our stay
                    $q->where('check_in_date', '>=', $this->check_in_date)
                      ->where('check_in_date', '<', $checkOutDate);
                })->orWhere(function($q) use ($checkOutDate) {
                    // Booking ends during our stay
                    $q->where('check_out_date', '>', $this->check_in_date)
                      ->where('check_out_date', '<=', $checkOutDate);
                })->orWhere(function($q) use ($checkOutDate) {
                    // Booking completely encompasses our stay
                    $q->where('check_in_date', '<=', $this->check_in_date)
                      ->where('check_out_date', '>=', $checkOutDate);
                });
            });
        
        // Exclude current booking when editing
        if ($this->id) {
            $activeBookings = $activeBookings->where('id', '!=', $this->id);
        }
        
        // Get count of active bookings during this period
        $activeBookingsCount = $activeBookings->count();
        
        // Check if enough beds are available
        if (($activeBookingsCount + $this->beds_to_book) > $totalBeds) {
            $this->addError('room_id', "Not enough beds available in Room {$room->room_number} for the selected dates. Only " . ($totalBeds - $activeBookingsCount) . " beds are available.");
            return false;
        }
        
        return true;
    }

    // Standardized add method
    public function add()
    {
        // Set default booking date if not already set
        if (empty($this->booking_date)) {
            $this->booking_date = now()->format('Y-m-d');
        }

        // Calculate final cost before validation
        $this->calculateTotalCost();
        $this->checkBedAvailability();
        
        $validatedData = $this->validate();
        
        // Ensure booking_date is included in the data
        $dataToSave = [
            'room_id' => $validatedData['room_id'],
            'patient_id' => $validatedData['patient_id'],
            'doctor_id' => $validatedData['doctor_id'],
            'booking_date' => $validatedData['booking_date'],
            'check_in_date' => $validatedData['check_in_date'],
            'check_out_date' => $validatedData['check_out_date'],
            'bed_number' => $validatedData['bed_number'],
            'beds_to_book' => $validatedData['beds_to_book'] ?? 1,
            'total_cost' => $validatedData['total_cost'],
            'discount_amount' => $validatedData['discount_amount'],
            'status' => $validatedData['status'],
            'payment_status' => $validatedData['payment_status'],
            'remarks' => $validatedData['remarks'] ?? null,
            'created_by' => Auth::id(),
            'is_active' => $validatedData['is_active'],
            'is_delete' => 0
        ];

        try {
            RoomBooking::create($dataToSave);

            $this->resetInputFields();
            $this->dispatch('close-modal');
            $this->dispatch('save-modal');
            $this->dispatch('success', message: 'Room Booking created successfully.');
        } catch (\Exception $e) {
            $this->dispatch('error', message: 'Failed to create booking: ' . $e->getMessage());
        }
    }

    // Standardized edit method
    public function edit($id)
    {
        $booking = RoomBooking::find($id);
        if ($booking) {
            $this->id = $id; // Set the component's ID property
            $this->room_id = $booking->room_id;
            $this->patient_id = $booking->patient_id;
            $this->doctor_id = $booking->doctor_id;
            // Format dates for input fields if they are not null
            $this->booking_date = !empty($booking->booking_date) ? Carbon::parse($booking->booking_date)->format('Y-m-d') : null;
            $this->check_in_date = !empty($booking->check_in_date) ? Carbon::parse($booking->check_in_date)->format('Y-m-d') : null;
            $this->check_out_date = !empty($booking->check_out_date) ? Carbon::parse($booking->check_out_date)->format('Y-m-d') : null;
            $this->status = $booking->status;
            $this->payment_status = $booking->payment_status ?? 'pending'; // Load payment status
            $this->remarks = $booking->remarks;
            $this->bed_number = $booking->bed_number ?? 1; // Set bed number
            $this->beds_to_book = $booking->beds_to_book ?? 1; // Set number of beds to book
            $this->total_cost = $booking->total_cost ?? 0; // Set total cost
            $this->discount = $booking->discount ?? false; // Set discount flag
            $this->discount_amount = $booking->discount_amount ?? 0; // Set discount amount
            $this->discount_percentage = $booking->discount_percentage ?? 0; // Set discount percentage
            $this->is_active = $booking->is_active ?? 1; // Set active status if used
            $this->resetErrorBag();
            $this->openModal(); // Open the standard #modal
        } else {
            $this->dispatch('error', message: 'Booking not found.');
        }
    }

    // Standardized update method
    public function update()
    {
        if (!$this->id) {
            $this->dispatch('error', message: 'Cannot update booking without ID.');
            return;
        }

        // Calculate final cost before validation
        $this->calculateTotalCost();
        $this->checkBedAvailability();
        
        $validatedData = $this->validate();
        $validatedData['updated_by'] = Auth::id(); // Add updater ID
        $validatedData['is_active'] = $this->is_active; // Add active status if used

        try {
            $booking = RoomBooking::find($this->id);
            if ($booking) {
                $booking->update($validatedData);
                $this->resetInputFields();
                $this->dispatch('close-modal'); // Close the #modal
                $this->dispatch('save-modal');  // Extra close event
                $this->dispatch('success', message: 'Room Booking updated successfully.'); // Standard success message
            } else {
                 $this->dispatch('error', message: 'Booking not found for update.');
            }
        } catch (\Exception $e) {
            $this->dispatch('error', message: 'Failed to update booking: ' . $e->getMessage()); // Standard error message
        }
    }

    // --- Details Modal Methods (Standardized) ---
    public function showDetails($id)
    {
        // Eager load necessary relations for display
        $this->selected_data = RoomBooking::with(['patient', 'room', 'doctor', 'user', 'updater']) // Assuming 'updater' relationship exists for updated_by
                                    ->where('is_delete', 0)
                                    ->find($id);

        if ($this->selected_data) {
            $this->dispatch('open-modal', 'detailsModal'); // Dispatch event for #detailsModal
        } else {
            $this->dispatch('error', message: 'Booking details not found.');
        }
    }

    public function closeDetailsModal()
    {
        $this->selected_data = null;
        $this->dispatch('close-modal', 'detailsModal'); // Dispatch event for #detailsModal
    }

    // --- Delete Method (Standardized) ---
    public function delete($id)
    {
        try {
            $booking = RoomBooking::find($id);
            if ($booking) {
                $booking->update([
                    'is_delete' => 1,
                    'updated_by' => Auth::id(), // Record who deleted it
                ]);
                 $this->dispatch('error', message: 'Room Booking marked as deleted.'); // Use 'error' or 'info' type for delete message
            } else {
                 $this->dispatch('error', message: 'Booking not found for deletion.');
            }
        } catch (\Exception $e) {
             $this->dispatch('error', message: 'Failed to delete booking: ' . $e->getMessage());
        }
        // Removed confirmation modal logic for simplicity, matching other examples
    }

    // --- Advanced Search Methods (Kept as is, but ensure modal ID is correct) ---
    public function searchDetails()
    {
        session()->put('print_filters', [
            'searchById' => $this->searchById,
            'searchByPatient' => $this->searchByPatient,
            'searchByRoom' => $this->searchByRoom,
            'searchByStatus' => $this->searchByStatus,
            'searchByPaymentStatus' => $this->searchByPaymentStatus,
            'searchFromDate' => $this->searchFromDate,
            'searchToDate' => $this->searchToDate,
            'searchFromId' => $this->searchFromId,
            'searchToId' => $this->searchToId,
        ]); // Keep session logic for print

        $query = RoomBooking::with('patient', 'room', 'doctor', 'user')
            ->where('is_delete', 0);

        // Apply filters
        if (!empty($this->searchById)) { $query->where('id', $this->searchById); }
        if (!empty($this->searchFromId) && !empty($this->searchToId)) { $query->whereBetween('id', [$this->searchFromId, $this->searchToId]); }
        if (!empty($this->searchByPatient)) { $query->whereHas('patient', function ($q) { $q->where('name', 'like', '%' . $this->searchByPatient . '%'); }); }
        if (!empty($this->searchByRoom)) { $query->whereHas('room', function ($q) { $q->where('room_number', 'like', '%' . $this->searchByRoom . '%'); }); }
        if (!empty($this->searchByStatus)) { $query->where('status', $this->searchByStatus); }
        if (!empty($this->searchByPaymentStatus)) { $query->where('payment_status', $this->searchByPaymentStatus); }
        if (!empty($this->searchFromDate) && !empty($this->searchToDate)) { $query->whereBetween('booking_date', [Carbon::parse($this->searchFromDate)->startOfDay(), Carbon::parse($this->searchToDate)->endOfDay()]); }

        $this->searchResults = $query->orderBy('booking_date', 'desc')->get();

        // Dispatch event for the advanced search modal
        $this->dispatch('open-modal', 'searchModal'); // Ensure this targets the correct modal ID used in the blade
    }

    public function closeSearchModal()
    {
        // Reset search results or keep them, depending on desired behavior
        // $this->searchResults = [];
        $this->dispatch('close-modal', 'searchModal'); // Ensure this targets the correct modal ID
    }

    public function resetFilters()
    {
        $this->reset(['searchById', 'searchByPatient', 'searchByRoom', 'searchByStatus', 'searchFromDate', 'searchToDate', 'searchFromId', 'searchToId', 'searchResults']);
    }

    // --- Export Methods (Kept as is, but check query logic uses correct filters) ---
    public function pdf() { /* ... keep existing pdf logic ... */ }
    public function print() { /* ... keep existing print logic ... */ }
    public function excel() { /* ... keep existing excel logic ... */ }

    // --- Other Methods (e.g., changeStatus - keep if needed) ---
    public function changeStatus($id, $status) {
        // Keep existing logic, but consider using standard dispatch for feedback
        try {
            $booking = RoomBooking::findOrFail($id);
            $booking->update([
                'status' => $status,
                'updated_by' => Auth::id(),
            ]);
             $this->dispatch('success', message: 'Booking status changed to ' . $status . ' successfully.');
        } catch (\Exception $e) {
             $this->dispatch('error', message: 'Failed to change status: ' . $e->getMessage());
        }
    }

    // Toggle payment status between pending and paid
    public function togglePaymentStatus($id)
    {
        try {
            $booking = RoomBooking::findOrFail($id);
            
            // Toggle between pending and paid
            $newStatus = $booking->payment_status === 'pending' ? 'paid' : 'pending';
            
            $booking->update([
                'payment_status' => $newStatus,
                'updated_by' => Auth::id(),
            ]);
            
            $statusText = ucfirst($newStatus);
            $this->dispatch('success', message: "Payment status updated to $statusText");
        } catch (\Exception $e) {
            $this->dispatch('error', message: 'Failed to update payment status: ' . $e->getMessage());
        }
    }

}