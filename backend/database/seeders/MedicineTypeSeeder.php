<?php

namespace Database\Seeders;

use App\Models\Hospital;
use App\Models\MedicineType;
use Illuminate\Database\Seeder;

class MedicineTypeSeeder extends Seeder
{
    public function run(): void
    {
        $hospitals = Hospital::query()->get();
        $types = [
            ['name' => 'Tablet', 'description' => 'Oral solid dosage form'],
            ['name' => 'Capsule', 'description' => 'Gelatin capsule form'],
            ['name' => 'Syrup', 'description' => 'Liquid oral formulation'],
            ['name' => 'Injection', 'description' => 'Injectable medication'],
        ];

        foreach ($hospitals as $hospital) {
            foreach ($types as $type) {
                MedicineType::updateOrCreate(
                    ['hospital_id' => $hospital->id, 'name' => $type['name']],
                    [
                        'description' => $type['description'],
                        'status' => 'active',
                    ]
                );
            }
        }
    }
}
