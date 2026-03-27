<?php

use App\Models\Hospital;
use App\Models\Patient;
use App\Models\PatientSurgery;
use App\Models\Surgery;
use App\Models\SurgeryType;
use App\Models\User;
use App\Services\SurgeryService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Validation\ValidationException;

uses(RefreshDatabase::class);

function createHospitalForSurgeryTests(): Hospital
{
    return Hospital::create([
        'name' => 'Surgery Hospital',
        'slug' => 'surgery-hospital',
        'email' => 'surgery@example.com',
        'subscription_status' => 'active',
    ]);
}

function createDoctorForSurgeryTests(int $hospitalId): User
{
    return User::create([
        'hospital_id' => $hospitalId,
        'name' => 'Doctor User',
        'email' => 'doctor@example.com',
        'password' => bcrypt('password'),
        'role' => 'doctor',
        'specialization' => 'General',
        'consultation_fee' => 0,
        'doctor_status' => 'active',
        'is_active' => true,
    ]);
}

function createPatientForSurgeryTests(int $hospitalId): Patient
{
    return Patient::create([
        'hospital_id' => $hospitalId,
        'patient_id' => 'P-2001',
        'name' => 'Patient Surgery',
        'gender' => 'female',
        'status' => 'active',
    ]);
}

test('surgery service uses surgery master cost when patient surgery cost is missing', function () {
    $hospital = createHospitalForSurgeryTests();
    $type = SurgeryType::create([
        'hospital_id' => $hospital->id,
        'name' => 'Orthopedic',
        'is_active' => true,
        'is_delete' => false,
    ]);

    $surgery = Surgery::create([
        'hospital_id' => $hospital->id,
        'name' => 'Knee Surgery',
        'type_id' => $type->id,
        'cost' => 25000,
        'is_active' => true,
        'is_delete' => false,
    ]);

    $service = app(SurgeryService::class);
    $resolved = $service->resolveCost($surgery, null);

    expect($resolved)->toBe(25000.0);
});

test('dependency protection prevents deleting surgery type with active surgery records', function () {
    $hospital = createHospitalForSurgeryTests();
    $type = SurgeryType::create([
        'hospital_id' => $hospital->id,
        'name' => 'Cardiac',
        'is_active' => true,
        'is_delete' => false,
    ]);

    Surgery::create([
        'hospital_id' => $hospital->id,
        'name' => 'Bypass',
        'type_id' => $type->id,
        'cost' => 55000,
        'is_active' => true,
        'is_delete' => false,
    ]);

    $service = app(SurgeryService::class);

    expect(fn () => $service->assertTypeDeletable($type))->toThrow(ValidationException::class);
});

test('dependency protection prevents deleting surgery with linked patient surgeries', function () {
    $hospital = createHospitalForSurgeryTests();
    $doctor = createDoctorForSurgeryTests($hospital->id);
    $patient = createPatientForSurgeryTests($hospital->id);

    $type = SurgeryType::create([
        'hospital_id' => $hospital->id,
        'name' => 'General',
        'is_active' => true,
        'is_delete' => false,
    ]);

    $surgery = Surgery::create([
        'hospital_id' => $hospital->id,
        'name' => 'Appendectomy',
        'type_id' => $type->id,
        'cost' => 12000,
        'is_active' => true,
        'is_delete' => false,
    ]);

    PatientSurgery::create([
        'hospital_id' => $hospital->id,
        'patient_id' => $patient->id,
        'doctor_id' => $doctor->id,
        'surgery_id' => $surgery->id,
        'surgery_date' => '2026-03-23',
        'status' => 'scheduled',
        'payment_status' => 'pending',
        'cost' => 12000,
        'is_active' => true,
        'is_delete' => false,
    ]);

    $service = app(SurgeryService::class);

    expect(fn () => $service->assertSurgeryDeletable($surgery))->toThrow(ValidationException::class);
});

test('payment toggle flips between pending and paid', function () {
    $hospital = createHospitalForSurgeryTests();
    $doctor = createDoctorForSurgeryTests($hospital->id);
    $patient = createPatientForSurgeryTests($hospital->id);

    $type = SurgeryType::create([
        'hospital_id' => $hospital->id,
        'name' => 'ENT',
        'is_active' => true,
        'is_delete' => false,
    ]);

    $surgery = Surgery::create([
        'hospital_id' => $hospital->id,
        'name' => 'Tonsillectomy',
        'type_id' => $type->id,
        'cost' => 9000,
        'is_active' => true,
        'is_delete' => false,
    ]);

    $patientSurgery = PatientSurgery::create([
        'hospital_id' => $hospital->id,
        'patient_id' => $patient->id,
        'doctor_id' => $doctor->id,
        'surgery_id' => $surgery->id,
        'surgery_date' => '2026-03-24',
        'status' => 'scheduled',
        'payment_status' => 'pending',
        'cost' => 9000,
        'is_active' => true,
        'is_delete' => false,
    ]);

    $service = app(SurgeryService::class);

    expect($service->togglePaymentStatus($patientSurgery))->toBe('paid');

    $patientSurgery->payment_status = 'paid';

    expect($service->togglePaymentStatus($patientSurgery))->toBe('pending');
});
