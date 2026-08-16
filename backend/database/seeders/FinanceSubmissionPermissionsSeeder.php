<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;

/**
 * Additive seeder for the daily finance submission (handover) report.
 *
 * The report itself needs no permission of its own: it reports exactly the
 * totals the user is already allowed to see on the dashboard. The one entry
 * here is a dashboard total that was missing entirely.
 *
 * RolesPermissionsSeeder truncates RBAC tables and is fresh-install only, so
 * these permissions need their own additive seeder to reach an existing
 * (production) database without touching users, roles or assignments.
 */
class FinanceSubmissionPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        foreach ($this->permissions() as $permission) {
            Permission::updateOrCreate(
                [
                    'name' => $permission['name'],
                    'guard_name' => 'web',
                ],
                [
                    'display_name' => $permission['display_name'],
                    'category' => $permission['category'],
                    'status' => 'active',
                    'is_system' => true,
                ]
            );
        }
    }

    /**
     * @return array<int, array{name: string, display_name: string, category: string}>
     */
    private function permissions(): array
    {
        return [
            [
                // Ultrasound income posts to the ledger under 'radiology' but
                // had no dashboard permission of its own, so it could not be
                // assigned to the desk responsible for collecting it.
                'name' => 'view_dashboard_ultrasound_fees',
                'display_name' => 'View Dashboard Total - Ultrasound Fees',
                'category' => 'Dashboard',
            ],
        ];
    }
}
