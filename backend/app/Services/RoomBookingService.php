<?php

namespace App\Services;

use App\Models\Room;
use App\Models\RoomBooking;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

class RoomBookingService
{
    private array $blockedStatuses = ['Pending', 'Confirmed', 'Checked-in'];

    public function calculateDays(string $checkInDate, ?string $checkOutDate): int
    {
        $start = Carbon::parse($checkInDate)->startOfDay();
        $end = $checkOutDate
            ? Carbon::parse($checkOutDate)->startOfDay()
            : Carbon::parse($checkInDate)->startOfDay();

        $days = $start->diffInDays($end);

        return max(1, $days);
    }

    public function calculateCosts(Room $room, int $bedsToBook, string $checkInDate, ?string $checkOutDate, float $discountAmount = 0): array
    {
        $days = $this->calculateDays($checkInDate, $checkOutDate);
        $baseCost = round($days * (float) $room->cost_per_bed * $bedsToBook, 2);
        $discount = round(max(0, $discountAmount), 2);
        $discount = min($baseCost, $discount);

        return [
            'days' => $days,
            'base_cost' => $baseCost,
            'discount_amount' => $discount,
            'total_cost' => round(max(0, $baseCost - $discount), 2),
        ];
    }

    public function getAvailability(Room $room, string $checkInDate, ?string $checkOutDate, ?int $ignoreBookingId = null): array
    {
        $start = Carbon::parse($checkInDate)->toDateString();
        $end = $checkOutDate ? Carbon::parse($checkOutDate)->toDateString() : $start;

        $query = RoomBooking::query()
            ->where('room_id', $room->id)
            ->where('is_delete', false)
            ->whereIn('status', $this->blockedStatuses)
            ->where(function ($q) use ($start, $end) {
                $q->where(function ($overlap) use ($start, $end) {
                    $overlap->whereDate('check_in_date', '<=', $end)
                        ->where(function ($inner) use ($start) {
                            $inner->whereNull('check_out_date')
                                ->orWhereDate('check_out_date', '>=', $start);
                        });
                });
            });

        if ($ignoreBookingId) {
            $query->where('id', '!=', $ignoreBookingId);
        }

        $overlapping = $query->get(['beds_to_book', 'bed_number']);
        $occupiedBeds = (int) $overlapping->sum('beds_to_book');

        $allBeds = $this->generateRoomBedLabels($room);

        $unavailableBeds = [];
        foreach ($overlapping as $booking) {
            $unavailableBeds = array_merge($unavailableBeds, $this->parseBedNumbers($booking->bed_number));
        }

        $unavailableBeds = array_values(array_unique($unavailableBeds));
        sort($unavailableBeds);

        $availableBeds = array_values(array_diff($allBeds, $unavailableBeds));
        $availableCount = max(0, (int) $room->total_beds - $occupiedBeds);

        return [
            'all_beds' => $allBeds,
            'unavailable_beds' => $unavailableBeds,
            'available_beds' => $availableBeds,
            'occupied_count' => $occupiedBeds,
            'available_count' => $availableCount,
        ];
    }

    public function assertAvailability(
        Room $room,
        string $checkInDate,
        ?string $checkOutDate,
        int $bedsToBook,
        ?int $ignoreBookingId = null,
        ?string $requestedBedNumbers = null
    ): void {
        $availability = $this->getAvailability($room, $checkInDate, $checkOutDate, $ignoreBookingId);
        $availableCount = (int) ($availability['available_count'] ?? 0);

        if ($bedsToBook > $availableCount) {
            throw ValidationException::withMessages([
                'beds_to_book' => [
                    'Requested beds exceed available beds for the selected date range.',
                ],
            ]);
        }

        $selectedBeds = $this->parseBedNumbers($requestedBedNumbers);
        if (empty($selectedBeds)) {
            return;
        }

        if (count($selectedBeds) !== count(array_unique($selectedBeds))) {
            throw ValidationException::withMessages([
                'bed_number' => [
                    'Duplicate bed numbers are not allowed.',
                ],
            ]);
        }

        if (count($selectedBeds) !== $bedsToBook) {
            throw ValidationException::withMessages([
                'bed_number' => [
                    'Number of selected beds must match beds to book.',
                ],
            ]);
        }

        $allBeds = $availability['all_beds'] ?? [];
        $unavailableBeds = $availability['unavailable_beds'] ?? [];

        $invalidBeds = array_values(array_diff($selectedBeds, $allBeds));
        if (!empty($invalidBeds)) {
            throw ValidationException::withMessages([
                'bed_number' => [
                    'One or more selected bed numbers do not exist in this room.',
                ],
            ]);
        }

        $conflicts = array_values(array_intersect($selectedBeds, $unavailableBeds));
        if (!empty($conflicts)) {
            throw ValidationException::withMessages([
                'bed_number' => [
                    'One or more selected beds are already booked for the selected dates.',
                ],
            ]);
        }
    }

    public function generateRoomBedLabels(Room $room): array
    {
        $labels = [];
        $total = max(0, (int) $room->total_beds);
        for ($i = 1; $i <= $total; $i++) {
            $labels[] = 'Bed-' . $i;
        }

        return $labels;
    }

    private function parseBedNumbers(?string $bedNumbers): array
    {
        if (!$bedNumbers) {
            return [];
        }

        $parts = preg_split('/[\s,]+/', trim($bedNumbers)) ?: [];
        $clean = array_values(array_filter(array_map(static fn ($value) => trim((string) $value), $parts)));

        return $clean;
    }
}
