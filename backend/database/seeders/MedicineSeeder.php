<?php

namespace Database\Seeders;

use App\Models\Hospital;
use App\Models\Manufacturer;
use App\Models\Medicine;
use App\Models\MedicineType;
use Illuminate\Database\Seeder;

class MedicineSeeder extends Seeder
{
    public function run(): void
    {
        $hospitals = Hospital::query()->get();

        foreach ($hospitals as $hospital) {
            $manufacturer = Manufacturer::query()->where('hospital_id', $hospital->id)->first();
            $type = MedicineType::query()->where('hospital_id', $hospital->id)->first();
            if (!$manufacturer || !$type) {
                continue;
            }

            $meds = [
                ['brand' => 'Paracetamol', 'generic' => 'Acetaminophen', 'strength' => '500mg', 'cost' => 0.08, 'sale' => 0.15],
                ['brand' => 'Amoxicillin', 'generic' => 'Amoxicillin', 'strength' => '500mg', 'cost' => 0.12, 'sale' => 0.25],
                ['brand' => 'Ibuprofen', 'generic' => 'Ibuprofen', 'strength' => '400mg', 'cost' => 0.10, 'sale' => 0.20],
                ['brand' => 'Omeprazole', 'generic' => 'Omeprazole', 'strength' => '20mg', 'cost' => 0.18, 'sale' => 0.35],
                ['brand' => 'Cetirizine', 'generic' => 'Cetirizine', 'strength' => '10mg', 'cost' => 0.06, 'sale' => 0.12],
            ];

            foreach ($meds as $med) {
                Medicine::updateOrCreate(
                    [
                        'hospital_id' => $hospital->id,
                        'brand_name' => $med['brand'],
                    ],
                    [
                        'manufacturer_id' => $manufacturer->id,
                        'medicine_type_id' => $type->id,
                        'generic_name' => $med['generic'],
                        'strength' => $med['strength'],
                        'stock' => 0,
                        'cost_price' => $med['cost'],
                        'sale_price' => $med['sale'],
                        'status' => 'active',
                    ]
                );
            }
        }
    }
}
