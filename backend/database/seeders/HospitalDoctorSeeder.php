<?php

namespace Database\Seeders;

use App\Models\Doctor;
use App\Models\Hospital;
use App\Models\User;
use Illuminate\Database\Seeder;

class HospitalDoctorSeeder extends Seeder
{
    public function run(): void
    {
        $records = [
            [
                'hospital' => [
                    'name' => 'City Care Hospital',
                    'slug' => 'city-care-hospital',
                    'email' => 'info@citycarehospital.com',
                    'phone' => '+1-202-555-0101',
                    'address' => '123 Main Street, Springfield',
                    'subscription_status' => 'active',
                ],
                'doctor' => [
                    'name' => 'Dr. Aisha Rahman',
                    'email' => 'aisha.rahman@citycarehospital.com',
                    'phone' => '+1-202-555-0191',
                    'specialization' => 'Cardiology',
                    'registration_number' => 'CC-DR-1001',
                    'consultation_fee' => 150,
                ],
            ],
            [
                'hospital' => [
                    'name' => 'Green Valley Medical Center',
                    'slug' => 'green-valley-medical',
                    'email' => 'contact@greenvalleymedical.com',
                    'phone' => '+1-202-555-0145',
                    'address' => '456 Oak Avenue, Rivertown',
                    'subscription_status' => 'active',
                ],
                'doctor' => [
                    'name' => 'Dr. Omar Siddiq',
                    'email' => 'omar.siddiq@greenvalleymedical.com',
                    'phone' => '+1-202-555-0132',
                    'specialization' => 'Pediatrics',
                    'registration_number' => 'GV-DR-2002',
                    'consultation_fee' => 120,
                ],
            ],
            [
                'hospital' => [
                    'name' => 'Sunrise Community Hospital',
                    'slug' => 'sunrise-community-hospital',
                    'email' => 'hello@sunrisecommunity.com',
                    'phone' => '+1-202-555-0177',
                    'address' => '789 Pine Road, Lakeside',
                    'subscription_status' => 'active',
                ],
                'doctor' => [
                    'name' => 'Dr. Lina Patel',
                    'email' => 'lina.patel@sunrisecommunity.com',
                    'phone' => '+1-202-555-0166',
                    'specialization' => 'Family Medicine',
                    'registration_number' => 'SC-DR-3003',
                    'consultation_fee' => 100,
                ],
            ],
        ];

        foreach ($records as $record) {
            $hospital = Hospital::updateOrCreate(
                ['slug' => $record['hospital']['slug']],
                $record['hospital']
            );

            $doctorData = $record['doctor'];
            $doctor = Doctor::updateOrCreate(
                ['email' => $doctorData['email'], 'hospital_id' => $hospital->id],
                [
                    'name' => $doctorData['name'],
                    'phone' => $doctorData['phone'],
                    'specialization' => $doctorData['specialization'],
                    'registration_number' => $doctorData['registration_number'],
                    'consultation_fee' => $doctorData['consultation_fee'],
                    'status' => 'active',
                ]
            );

            User::updateOrCreate(
                ['email' => $doctorData['email']],
                [
                    'name' => $doctorData['name'],
                    'hospital_id' => $hospital->id,
                    'role' => 'doctor',
                    'doctor_id' => $doctor->id,
                    'password' => 'password123',
                    'phone' => $doctorData['phone'],
                    'specialization' => $doctorData['specialization'],
                    'registration_number' => $doctorData['registration_number'],
                    'consultation_fee' => $doctorData['consultation_fee'],
                    'doctor_status' => 'active',
                    'is_active' => true,
                ]
            );
        }
    }
}
