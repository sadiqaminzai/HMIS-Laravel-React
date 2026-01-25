<?php

namespace Database\Seeders;

use App\Models\Hospital;
use App\Models\Manufacturer;
use Illuminate\Database\Seeder;

class ManufacturerSeeder extends Seeder
{
    public function run(): void
    {
        $hospitals = Hospital::query()->get();
        foreach ($hospitals as $hospital) {
            $items = [
                ['name' => 'Acme Pharma', 'license_number' => 'ACM-' . $hospital->id . '-001', 'country' => 'USA'],
                ['name' => 'HealWell Labs', 'license_number' => 'HWL-' . $hospital->id . '-002', 'country' => 'India'],
                ['name' => 'NovaMed', 'license_number' => 'NVM-' . $hospital->id . '-003', 'country' => 'Germany'],
            ];

            foreach ($items as $item) {
                Manufacturer::updateOrCreate(
                    ['hospital_id' => $hospital->id, 'license_number' => $item['license_number']],
                    [
                        'name' => $item['name'],
                        'country' => $item['country'],
                        'status' => 'active',
                    ]
                );
            }
        }
    }
}
