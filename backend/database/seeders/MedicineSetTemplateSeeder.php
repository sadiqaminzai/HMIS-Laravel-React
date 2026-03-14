<?php

namespace Database\Seeders;

use App\Models\Hospital;
use App\Models\Medicine;
use App\Models\MedicineSet;
use Illuminate\Database\Seeder;

class MedicineSetTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $templateItems = [
            ['name' => 'RL 500ml', 'search' => 'rl', 'type' => 'IV Fluid', 'dose' => 'As directed', 'duration' => '1 day', 'instruction' => 'with_meal', 'quantity' => 1],
            ['name' => 'Neurobexin injection', 'search' => 'neurobexin', 'type' => 'Injection', 'dose' => '1 amp', 'duration' => '1 day', 'instruction' => 'with_meal', 'quantity' => 1],
            ['name' => 'Vit C injection', 'search' => 'vit c', 'type' => 'Injection', 'dose' => '1 amp', 'duration' => '1 day', 'instruction' => 'with_meal', 'quantity' => 1],
            ['name' => 'NOSP injection', 'search' => 'nosp', 'type' => 'Injection', 'dose' => '1 amp', 'duration' => '1 day', 'instruction' => 'with_meal', 'quantity' => 1],
        ];

        Hospital::query()->select('id')->chunkById(50, function ($hospitals) use ($templateItems) {
            foreach ($hospitals as $hospital) {
                $set = MedicineSet::updateOrCreate(
                    ['hospital_id' => $hospital->id, 'name' => 'IV Support Set'],
                    ['description' => 'Predefined IV + injection treatment set', 'status' => 'active', 'updated_by' => 'system']
                );

                $set->items()->delete();

                foreach ($templateItems as $index => $templateItem) {
                    $matchedMedicine = Medicine::query()
                        ->where('hospital_id', $hospital->id)
                        ->where('status', 'active')
                        ->where(function ($query) use ($templateItem) {
                            $query->where('brand_name', 'like', '%' . $templateItem['search'] . '%')
                                ->orWhere('generic_name', 'like', '%' . $templateItem['search'] . '%');
                        })
                        ->orderByDesc('id')
                        ->first();

                    $set->items()->create([
                        'medicine_id' => $matchedMedicine?->id,
                        'medicine_name' => $matchedMedicine?->brand_name ?? $templateItem['name'],
                        'strength' => $matchedMedicine?->strength,
                        'dose' => $templateItem['dose'],
                        'duration' => $templateItem['duration'],
                        'instruction' => $templateItem['instruction'],
                        'quantity' => $templateItem['quantity'],
                        'type' => $matchedMedicine?->medicineType?->name ?? $templateItem['type'],
                        'sort_order' => $index,
                    ]);
                }
            }
        });
    }
}
