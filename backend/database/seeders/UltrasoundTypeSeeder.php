<?php

namespace Database\Seeders;

use App\Models\Hospital;
use App\Models\UltrasoundType;
use Illuminate\Database\Seeder;

/**
 * Seeds the default ultrasound types and their report templates for every
 * hospital. Templates are plain HTML so the rich text editor can load and
 * round-trip them; hospitals are free to edit or add their own afterwards.
 */
class UltrasoundTypeSeeder extends Seeder
{
    public function run(): void
    {
        $hospitals = Hospital::query()->pluck('id');

        foreach ($hospitals as $hospitalId) {
            foreach ($this->defaults() as $index => $type) {
                UltrasoundType::updateOrCreate(
                    ['hospital_id' => $hospitalId, 'name' => $type['name']],
                    [
                        'code' => $type['code'],
                        'description' => $type['description'] ?? null,
                        'default_template' => $this->template($type['sections']),
                        'sort_order' => $index,
                        'is_active' => true,
                    ]
                );
            }
        }
    }

    /**
     * Render a section list into the HTML template stored on the type.
     *
     * @param  array<int, string>  $sections
     */
    private function template(array $sections): string
    {
        $lines = array_map(
            fn (string $section) => '<p><strong>'.e($section).':</strong> </p>',
            $sections
        );

        return implode("\n", $lines);
    }

    /**
     * @return array<int, array{name: string, code: string, description?: string, sections: array<int, string>}>
     */
    private function defaults(): array
    {
        return [
            [
                'name' => 'Abdomen',
                'code' => 'US-ABD',
                'description' => 'Complete abdominal ultrasound.',
                'sections' => ['Liver', 'Gall Bladder', 'CBD', 'Pancreas', 'Spleen', 'Kidneys', 'Urinary Bladder', 'Impression'],
            ],
            [
                'name' => 'Pelvis',
                'code' => 'US-PEL',
                'description' => 'Pelvic ultrasound.',
                'sections' => ['Urinary Bladder', 'Uterus', 'Endometrium', 'Right Ovary', 'Left Ovary', 'Pouch of Douglas', 'Impression'],
            ],
            [
                'name' => 'Obstetrics',
                'code' => 'US-OBS',
                'description' => 'Obstetric / pregnancy ultrasound.',
                'sections' => ['Gestational Sac', 'Fetal Heart Rate', 'Fetal Lie / Presentation', 'BPD', 'HC', 'AC', 'FL', 'Estimated Fetal Weight', 'Gestational Age', 'Amniotic Fluid Index', 'Placenta', 'Impression'],
            ],
            [
                'name' => 'Gynecology',
                'code' => 'US-GYN',
                'description' => 'Gynecological ultrasound.',
                'sections' => ['Uterus', 'Myometrium', 'Endometrium', 'Cervix', 'Right Adnexa', 'Left Adnexa', 'Free Fluid', 'Impression'],
            ],
            [
                'name' => 'Kidney',
                'code' => 'US-KID',
                'description' => 'Renal ultrasound (KUB).',
                'sections' => ['Right Kidney', 'Left Kidney', 'Cortical Echogenicity', 'Pelvicalyceal System', 'Ureters', 'Urinary Bladder', 'Impression'],
            ],
            [
                'name' => 'Liver',
                'code' => 'US-LIV',
                'description' => 'Hepatobiliary ultrasound.',
                'sections' => ['Liver Size', 'Echotexture', 'Focal Lesions', 'Portal Vein', 'Hepatic Veins', 'Gall Bladder', 'CBD', 'Impression'],
            ],
            [
                'name' => 'Thyroid',
                'code' => 'US-THY',
                'description' => 'Thyroid ultrasound.',
                'sections' => ['Right Lobe', 'Left Lobe', 'Isthmus', 'Echotexture', 'Nodules', 'Vascularity', 'Cervical Lymph Nodes', 'Impression'],
            ],
            [
                'name' => 'Breast',
                'code' => 'US-BRE',
                'description' => 'Breast ultrasound.',
                'sections' => ['Right Breast', 'Left Breast', 'Ducts', 'Focal Lesions', 'Right Axilla', 'Left Axilla', 'Impression'],
            ],
            [
                'name' => 'Doppler',
                'code' => 'US-DOP',
                'description' => 'Doppler / vascular study.',
                'sections' => ['Region Examined', 'Arterial Flow', 'Venous Flow', 'Compressibility', 'Thrombus', 'Peak Systolic Velocity', 'Resistive Index', 'Impression'],
            ],
            [
                'name' => 'Soft Tissue',
                'code' => 'US-SFT',
                'description' => 'Soft tissue ultrasound.',
                'sections' => ['Site Examined', 'Lesion Size', 'Echotexture', 'Margins', 'Vascularity', 'Underlying Structures', 'Regional Lymph Nodes', 'Impression'],
            ],
            [
                'name' => 'Other',
                'code' => 'US-OTH',
                'description' => 'Free-form ultrasound report.',
                'sections' => ['Examination', 'Findings', 'Impression'],
            ],
        ];
    }
}
