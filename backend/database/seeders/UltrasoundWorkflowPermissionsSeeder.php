<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Additive seeder for the ultrasound reception/specialist split.
 *
 * Only genuinely new actions are added. Creating, viewing, editing and printing
 * an exam already have permissions and are reused as they are: reporting is
 * edit_ultrasound_exams, the A4 report is print_ultrasound_exams. What did not
 * exist was the money side, because an exam had no payment to control.
 *
 * RolesPermissionsSeeder truncates RBAC tables and is fresh-install only, so
 * these need their own additive seeder to reach an existing (production)
 * database without touching users, roles or assignments.
 */
class UltrasoundWorkflowPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        // Ultrasound is the only thing in Radiology, and its permissions were
        // filed under a category name that appears nowhere in the interface.
        // Moving them gives the module one tab of its own, where the financial
        // controls sit beside the CRUD ones they qualify.
        Permission::where('name', 'like', '%ultrasound%')
            ->where('category', 'Radiology')
            ->update(['category' => 'Ultrasound']);

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

        $this->migrate('add_ultrasound_exams', 'add_ultrasound_receipt');
        $this->migrate('edit_ultrasound_exams', 'submit_ultrasound_result');
    }

    /**
     * Move any role holding a retired permission onto its replacement, then
     * remove the retired one.
     *
     * Deleting outright would silently strip access from roles that already
     * had it, so the grant is copied across first.
     */
    private function migrate(string $from, string $to): void
    {
        $old = Permission::where('name', $from)->where('guard_name', 'web')->first();
        $new = Permission::where('name', $to)->where('guard_name', 'web')->first();

        if (!$old || !$new) {
            return;
        }

        $rows = DB::table('role_has_permissions')
            ->where('permission_id', $old->id)
            ->pluck('role_id');

        foreach ($rows as $roleId) {
            DB::table('role_has_permissions')->updateOrInsert(
                ['permission_id' => $new->id, 'role_id' => $roleId],
                ['permission_id' => $new->id, 'role_id' => $roleId]
            );
        }

        DB::table('role_has_permissions')->where('permission_id', $old->id)->delete();
        DB::table('model_has_permissions')->where('permission_id', $old->id)->delete();
        $old->delete();
    }

    /**
     * @return array<int, array{name: string, display_name: string, category: string}>
     */
    private function permissions(): array
    {
        return [
            [
                'name' => 'manage_ultrasound_payments',
                'display_name' => 'Take Ultrasound Payments',
                'category' => 'Ultrasound',
            ],
            [
                // Whoever raises the order should not necessarily set what it
                // costs; the same control covers the price on a report
                // template, since that is where the fee is defaulted from.
                'name' => 'set_ultrasound_fee',
                'display_name' => 'Set Ultrasound Fee / Price',
                'category' => 'Ultrasound',
            ],
            [
                'name' => 'reverse_ultrasound_payment',
                'display_name' => 'Reverse Ultrasound Payment',
                'category' => 'Ultrasound',
            ],
            [
                // The receipt is a financial document and the report a clinical
                // one; a receptionist needs the first without the second.
                'name' => 'print_ultrasound_receipt',
                'display_name' => 'Print Ultrasound Receipt',
                'category' => 'Ultrasound',
            ],
            [
                // The escape hatch for a genuine exception, rather than leaving
                // the unpaid check to be worked around by editing records.
                'name' => 'complete_unpaid_ultrasound',
                'display_name' => 'Complete An Unpaid Ultrasound Exam',
                'category' => 'Ultrasound',
            ],
            [
                // An exam is raised as a receipt at the counter, so the right
                // to create one belongs with the receipt, not with the exam.
                'name' => 'add_ultrasound_receipt',
                'display_name' => 'Create Ultrasound Receipt',
                'category' => 'Ultrasound',
            ],
            [
                // Replaces edit_ultrasound_exams. Filing the report is not
                // "editing a record": it is the act the whole exam list exists
                // for, and it stamps the filer as the radiologist.
                'name' => 'submit_ultrasound_result',
                'display_name' => 'Submit Ultrasound Result',
                'category' => 'Ultrasound',
            ],
        ];
    }
}
