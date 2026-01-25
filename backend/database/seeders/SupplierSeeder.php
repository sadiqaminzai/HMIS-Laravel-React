<?php

namespace Database\Seeders;

use App\Models\Hospital;
use App\Models\Supplier;
use Illuminate\Database\Seeder;

class SupplierSeeder extends Seeder
{
    public function run(): void
    {
        $hospitals = Hospital::query()->get();
        foreach ($hospitals as $hospital) {
            $suppliers = [
                ['name' => 'Global Med Supplies', 'contact_info' => '+93 700 111 111', 'address' => 'Kabul'],
                ['name' => 'HealthCare Distributors', 'contact_info' => '+93 700 222 222', 'address' => 'Herat'],
                ['name' => 'Pharma Wholesale', 'contact_info' => '+93 700 333 333', 'address' => 'Kandahar'],
            ];

            foreach ($suppliers as $supplier) {
                Supplier::updateOrCreate(
                    ['hospital_id' => $hospital->id, 'name' => $supplier['name']],
                    [
                        'contact_info' => $supplier['contact_info'],
                        'address' => $supplier['address'],
                    ]
                );
            }
        }
    }
}
