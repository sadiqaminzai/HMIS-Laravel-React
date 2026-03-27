<?php

namespace App\Http\Controllers;

use App\Models\Room;
use App\Models\RoomBooking;
use App\Services\LedgerPostingService;
use App\Services\RoomBookingService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RoomBookingController extends Controller
{
    public function __construct(
        private readonly RoomBookingService $bookingService,
        private readonly LedgerPostingService $ledgerPostingService
    )
    {
    }

    public function index(Request $request)
    {
        $user = $request->user();

        $query = RoomBooking::query()
            ->with([
                'room:id,room_number,type,hospital_id',
                'patient:id,name,patient_id,hospital_id',
                'doctor:id,name,hospital_id',
            ])
            ->where('is_delete', false);

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id ?? 0);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('id')) {
            $query->where('id', $request->integer('id'));
        }

        if ($request->filled('id_from')) {
            $query->where('id', '>=', $request->integer('id_from'));
        }

        if ($request->filled('id_to')) {
            $query->where('id', '<=', $request->integer('id_to'));
        }

        if ($request->filled('patient_id')) {
            $query->where('patient_id', $request->integer('patient_id'));
        }

        if ($request->filled('room_id')) {
            $query->where('room_id', $request->integer('room_id'));
        }

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('payment_status')) {
            $query->where('payment_status', $request->string('payment_status'));
        }

        if ($request->filled('date_from')) {
            $query->whereDate('check_in_date', '>=', $request->date('date_from'));
        }

        if ($request->filled('date_to')) {
            $query->whereDate('check_in_date', '<=', $request->date('date_to'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('bed_number', 'like', "%{$search}%")
                    ->orWhere('remarks', 'like', "%{$search}%");
            });
        }

        return response()->json($query->orderByDesc('id')->paginate($request->integer('per_page', 25)));
    }

    public function availability(Request $request)
    {
        $data = $request->validate([
            'room_id' => ['required', 'exists:rooms,id'],
            'check_in_date' => ['required', 'date'],
            'check_out_date' => ['nullable', 'date', 'after_or_equal:check_in_date'],
            'ignore_booking_id' => ['nullable', 'integer', 'exists:room_bookings,id'],
            'beds_to_book' => ['nullable', 'integer', 'min:1'],
        ]);

        $room = Room::query()->findOrFail((int) $data['room_id']);

        if ($request->user()->role !== 'super_admin') {
            $this->assertScopedRoom($room, (int) $request->user()->hospital_id);
        } elseif ($request->filled('hospital_id')) {
            $this->assertScopedRoom($room, (int) $request->integer('hospital_id'));
        }

        $availability = $this->bookingService->getAvailability(
            $room,
            $data['check_in_date'],
            $data['check_out_date'] ?? null,
            $data['ignore_booking_id'] ?? null
        );

        $bedsToBook = max(1, (int) ($data['beds_to_book'] ?? 1));
        $availability['suggested_beds'] = array_slice($availability['available_beds'] ?? [], 0, $bedsToBook);

        return response()->json($availability);
    }

    public function store(Request $request)
    {
        $data = $this->validatePayload($request);
        $user = $request->user();

        $data['created_by'] = $user?->name;

        $booking = DB::transaction(function () use ($data) {
            $room = Room::query()->findOrFail($data['room_id']);
            $this->assertScopedRoom($room, (int) $data['hospital_id']);

            $this->bookingService->assertAvailability(
                $room,
                $data['check_in_date'],
                $data['check_out_date'] ?? null,
                (int) $data['beds_to_book'],
                null,
                $data['bed_number'] ?? null
            );

            $costs = $this->bookingService->calculateCosts(
                $room,
                (int) $data['beds_to_book'],
                $data['check_in_date'],
                $data['check_out_date'] ?? null,
                (float) ($data['discount_amount'] ?? 0)
            );

            $data['discount_amount'] = $costs['discount_amount'];
            $data['total_cost'] = $costs['total_cost'];

            $booking = RoomBooking::create($data);
            $this->ledgerPostingService->upsertRoomBookingSnapshot($booking);

            return $booking;
        });

        return response()->json($booking->load(['room', 'patient', 'doctor']), 201);
    }

    public function show(Request $request, RoomBooking $roomBooking)
    {
        $this->authorizeScope($request->user(), $roomBooking->hospital_id);

        return response()->json($roomBooking->load(['room', 'patient', 'doctor']));
    }

    public function update(Request $request, RoomBooking $roomBooking)
    {
        $this->authorizeScope($request->user(), $roomBooking->hospital_id);

        $data = $this->validatePayload($request, $roomBooking->hospital_id);
        $data['updated_by'] = $request->user()?->name;

        DB::transaction(function () use ($data, $roomBooking) {
            $nextStatus = (string) ($data['status'] ?? $roomBooking->status);
            $this->ensureValidStatusTransition((string) $roomBooking->status, $nextStatus);

            if ($nextStatus === 'Checked-out' && empty($data['check_out_date'])) {
                $data['check_out_date'] = now()->toDateString();
            }

            $room = Room::query()->findOrFail($data['room_id']);
            $this->assertScopedRoom($room, (int) $data['hospital_id']);

            $this->bookingService->assertAvailability(
                $room,
                $data['check_in_date'],
                $data['check_out_date'] ?? null,
                (int) $data['beds_to_book'],
                $roomBooking->id,
                $data['bed_number'] ?? null
            );

            $costs = $this->bookingService->calculateCosts(
                $room,
                (int) $data['beds_to_book'],
                $data['check_in_date'],
                $data['check_out_date'] ?? null,
                (float) ($data['discount_amount'] ?? 0)
            );

            $data['discount_amount'] = $costs['discount_amount'];
            $data['total_cost'] = $costs['total_cost'];

            $roomBooking->update($data);

            if ((string) $roomBooking->status === 'Cancelled' || (string) $roomBooking->payment_status === 'cancelled') {
                $this->ledgerPostingService->voidRoomBookingSnapshot($roomBooking, $data['updated_by'] ?? null);
            } else {
                $this->ledgerPostingService->upsertRoomBookingSnapshot($roomBooking);
            }
        });

        return response()->json($roomBooking->fresh()->load(['room', 'patient', 'doctor']));
    }

    public function destroy(Request $request, RoomBooking $roomBooking)
    {
        $this->authorizeScope($request->user(), $roomBooking->hospital_id);

        $roomBooking->update([
            'is_delete' => true,
            'is_active' => false,
            'deleted_by' => $request->user()?->name,
            'status' => 'Cancelled',
            'payment_status' => 'cancelled',
        ]);
        $this->ledgerPostingService->voidRoomBookingSnapshot($roomBooking, $request->user()?->name);

        return response()->json(['message' => 'Room booking deleted']);
    }

    private function validatePayload(Request $request, ?int $existingHospitalId = null): array
    {
        $hospitalId = $request->user()->role === 'super_admin'
            ? ($request->integer('hospital_id') ?: $existingHospitalId)
            : $request->user()->hospital_id;

        $data = $request->validate([
            'hospital_id' => [
                $request->user()->role === 'super_admin' ? 'required' : 'nullable',
                'exists:hospitals,id',
            ],
            'room_id' => ['required', 'exists:rooms,id'],
            'patient_id' => ['required', 'exists:patients,id'],
            'doctor_id' => ['nullable', 'exists:users,id'],
            'booking_date' => ['required', 'date'],
            'check_in_date' => ['required', 'date'],
            'check_out_date' => ['nullable', 'date', 'after_or_equal:check_in_date'],
            'bed_number' => ['nullable', 'string', 'max:255'],
            'beds_to_book' => ['required', 'integer', 'min:1'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'status' => ['required', 'in:Pending,Confirmed,Checked-in,Checked-out,Cancelled'],
            'payment_status' => ['required', 'in:pending,paid,partial,cancelled'],
            'remarks' => ['nullable', 'string'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        } elseif (!isset($data['hospital_id'])) {
            $data['hospital_id'] = $hospitalId;
        }

        return $data;
    }

    private function assertScopedRoom(Room $room, int $hospitalId): void
    {
        if ((int) $room->hospital_id !== $hospitalId || (bool) $room->is_delete) {
            abort(422, 'Room does not belong to selected hospital');
        }
    }

    private function authorizeScope($user, int $hospitalId): void
    {
        if ($user->role !== 'super_admin' && (int) $user->hospital_id !== (int) $hospitalId) {
            abort(403, 'Unauthorized access');
        }
    }

    private function ensureValidStatusTransition(string $currentStatus, string $nextStatus): void
    {
        $allowedTransitions = [
            'Pending' => ['Pending', 'Confirmed', 'Cancelled'],
            'Confirmed' => ['Confirmed', 'Checked-in', 'Cancelled'],
            'Checked-in' => ['Checked-in', 'Checked-out', 'Cancelled'],
            'Checked-out' => ['Checked-out'],
            'Cancelled' => ['Cancelled'],
        ];

        $allowed = $allowedTransitions[$currentStatus] ?? [$currentStatus];

        if (!in_array($nextStatus, $allowed, true)) {
            abort(422, "Invalid status transition from {$currentStatus} to {$nextStatus}");
        }
    }
}
