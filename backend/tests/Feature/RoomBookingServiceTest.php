<?php

use App\Models\Hospital;
use App\Models\Patient;
use App\Models\Room;
use App\Models\RoomBooking;
use App\Services\RoomBookingService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

function createHospitalForRoomTests(): Hospital
{
    return Hospital::create([
        'name' => 'Test Hospital',
        'slug' => 'test-hospital',
        'email' => 'hospital@example.com',
        'subscription_status' => 'active',
    ]);
}

function createPatientForRoomTests(int $hospitalId): Patient
{
    return Patient::create([
        'hospital_id' => $hospitalId,
        'patient_id' => 'P-1001',
        'name' => 'Patient One',
        'gender' => 'male',
        'status' => 'active',
    ]);
}

test('room booking overlap check rejects when requested beds exceed overlapping availability', function () {
    $hospital = createHospitalForRoomTests();
    $patient = createPatientForRoomTests($hospital->id);
    $room = Room::create([
        'hospital_id' => $hospital->id,
        'room_number' => 'R-101',
        'type' => 'General',
        'total_beds' => 2,
        'available_beds' => 2,
        'cost_per_bed' => 500,
        'is_active' => true,
        'is_delete' => false,
    ]);

    RoomBooking::create([
        'hospital_id' => $hospital->id,
        'room_id' => $room->id,
        'patient_id' => $patient->id,
        'booking_date' => '2026-03-20',
        'check_in_date' => '2026-03-21',
        'check_out_date' => '2026-03-25',
        'beds_to_book' => 2,
        'total_cost' => 4000,
        'discount_amount' => 0,
        'status' => 'Confirmed',
        'payment_status' => 'pending',
        'is_active' => true,
        'is_delete' => false,
    ]);

    $service = app(RoomBookingService::class);

    expect(fn () => $service->assertAvailability($room, '2026-03-22', '2026-03-23', 1))
        ->toThrow(ValidationException::class);
});

test('room booking calculates days and total cost with minimum one day', function () {
    $hospital = createHospitalForRoomTests();
    $room = Room::create([
        'hospital_id' => $hospital->id,
        'room_number' => 'R-202',
        'type' => 'Private',
        'total_beds' => 3,
        'available_beds' => 3,
        'cost_per_bed' => 1000,
        'is_active' => true,
        'is_delete' => false,
    ]);

    $service = app(RoomBookingService::class);

    $costs = $service->calculateCosts($room, 2, '2026-03-23', '2026-03-23', 300);

    expect($costs['days'])->toBe(1)
        ->and($costs['base_cost'])->toBe(2000.0)
        ->and($costs['discount_amount'])->toBe(300.0)
        ->and($costs['total_cost'])->toBe(1700.0);
});
