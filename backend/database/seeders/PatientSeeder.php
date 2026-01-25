<?php

namespace Database\Seeders;

use App\Models\Hospital;
use App\Models\Patient;
use Illuminate\Database\Seeder;

class PatientSeeder extends Seeder
{
    public function run(): void
    {
        $hospitals = Hospital::query()->get();
        foreach ($hospitals as $hospital) {
            for ($i = 1; $i <= 10; $i++) {
                $patientId = 'P' . str_pad((string) $i, 4, '0', STR_PAD_LEFT);
                Patient::updateOrCreate(
                    ['hospital_id' => $hospital->id, 'patient_id' => $patientId],
                    [
                        'name' => "Patient {$i}",
                        'age' => 20 + $i,
                        'gender' => $i % 2 === 0 ? 'female' : 'male',
                        'phone' => '0700' . str_pad((string) $i, 4, '0', STR_PAD_LEFT),
                        'address' => 'Demo Street ' . $i,
                        'status' => 'active',
                    ]
                );
            }
        }
    }
}
