<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Additive seeder for the lab workflow's financial controls.
 *
 * These are not duplicates of the existing lab permissions: taking a payment
 * and undoing one are different acts, and until now they shared
 * manage_lab_payments, so every user who could collect could also reverse.
 * Moving an order backwards through the workflow is likewise distinct from
 * advancing it.
 *
 * RolesPermissionsSeeder truncates RBAC tables and is fresh-install only, so
 * these need their own additive seeder to reach an existing (production)
 * database without touching users, roles or assignments.
 */
class LabWorkflowPermissionsSeeder extends Seeder
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

        $this->grantExplicitPaymentRights();
    }

    /**
     * Give manage_lab_payments to roles that were relying on edit_lab_orders.
     *
     * Taking a payment and entering a result both used to fall back to
     * edit_lab_orders, so a receptionist could do laboratory work. Those two
     * are now gated on their own permissions -- but reception must not lose
     * the ability to collect a fee in the process, so the payment right they
     * held implicitly is made explicit here. Result entry is deliberately NOT
     * carried over: that is the separation this change exists to create.
     */
    private function grantExplicitPaymentRights(): void
    {
        $payments = Permission::where('name', 'manage_lab_payments')->where('guard_name', 'web')->first();
        $editOrders = Permission::where('name', 'edit_lab_orders')->where('guard_name', 'web')->first();

        if (!$payments || !$editOrders) {
            return;
        }

        $roleIds = DB::table('role_has_permissions')
            ->where('permission_id', $editOrders->id)
            ->pluck('role_id');

        foreach ($roleIds as $roleId) {
            DB::table('role_has_permissions')->updateOrInsert(
                ['permission_id' => $payments->id, 'role_id' => $roleId],
                ['permission_id' => $payments->id, 'role_id' => $roleId]
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
                'name' => 'reverse_lab_payment',
                'display_name' => 'Reverse Lab Payment (Paid to Unpaid)',
                'category' => 'Laboratory',
            ],
            [
                'name' => 'reverse_lab_order_status',
                'display_name' => 'Move Lab Order Backwards In Workflow',
                'category' => 'Laboratory',
            ],
            [
                'name' => 'cancel_paid_lab_order',
                'display_name' => 'Cancel A Paid Lab Order',
                'category' => 'Laboratory',
            ],
        ];
    }
}
