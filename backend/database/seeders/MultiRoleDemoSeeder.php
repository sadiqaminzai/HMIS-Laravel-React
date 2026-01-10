<?php

namespace Database\Seeders;

use App\Models\Hospital;
use App\Models\User;
use Illuminate\Database\Seeder;

class MultiRoleDemoSeeder extends Seeder
{
    public function run(): void
    {
        // Ensure a demo hospital exists for tenant-scoped roles
        $hospital = Hospital::firstOrCreate(
            ['slug' => 'demo-hospital'],
            [
                'name' => 'Demo Hospital',
                'email' => 'info@demo-hospital.com',
                'subscription_status' => 'active',
            ]
        );

        $users = [
            [
                'name' => 'Super Admin',
                'email' => 'superadmin@shifaascript.com',
                'role' => 'super_admin',
                'hospital_id' => null,
                'password' => 'admin123',
            ],
            [
                'name' => 'Admin User',
                'email' => 'admin@hospital.com',
                'role' => 'admin',
                'hospital_id' => $hospital->id,
                'password' => 'admin123',
            ],
            [
                'name' => 'Dr. Sarah Johnson',
                'email' => 'sarah.johnson@hospital.com',
                'role' => 'doctor',
                'hospital_id' => $hospital->id,
                'password' => 'doctor123',
            ],
            [
                'name' => 'Reception Desk',
                'email' => 'receptionist@hospital.com',
                'role' => 'receptionist',
                'hospital_id' => $hospital->id,
                'password' => 'reception123',
            ],
            [
                'name' => 'Pharmacy User',
                'email' => 'pharmacist@hospital.com',
                'role' => 'pharmacist',
                'hospital_id' => $hospital->id,
                'password' => 'pharmacy123',
            ],
            [
                'name' => 'Lab Tech',
                'email' => 'labtech@hospital.com',
                'role' => 'lab_technician',
                'hospital_id' => $hospital->id,
                'password' => 'lab123',
            ],
        ];

        foreach ($users as $data) {
            User::updateOrCreate(
                ['email' => $data['email']],
                [
                    'name' => $data['name'],
                    'hospital_id' => $data['hospital_id'],
                    'role' => $data['role'],
                    'password' => $data['password'], // hashed by cast
                    'is_active' => true,
                ]
            );
        }
    }
}
