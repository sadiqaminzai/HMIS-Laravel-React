<?php

namespace Database\Seeders;

use App\Models\Permission;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Additive seeder for OPD fee collection.
 *
 * manage_appointment_payments already existed but was held by nobody, so every
 * appointment fell back to 'pending' and registration fees never appeared as
 * collected money. It is granted here to the roles that register patients --
 * they are the desk taking the fee -- and reversal is added as its own right.
 *
 * RolesPermissionsSeeder truncates RBAC tables and is fresh-install only, so
 * this needs its own additive seeder to reach an existing (production)
 * database without touching users, roles or assignments.
 */
class AppointmentPaymentPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        Permission::updateOrCreate(
            ['name' => 'reverse_appointment_payment', 'guard_name' => 'web'],
            [
                'display_name' => 'Reverse Appointment Payment (Paid to Pending)',
                'category' => 'Appointments',
                'status' => 'active',
                'is_system' => true,
            ]
        );

        $this->grantCollectionRightToRegistrars();
    }

    /**
     * Whoever may create an appointment takes the fee at the counter, so they
     * get the right to record it. Reversal is deliberately not granted.
     */
    private function grantCollectionRightToRegistrars(): void
    {
        $payments = Permission::where('name', 'manage_appointment_payments')
            ->where('guard_name', 'web')
            ->first();
        $addAppointments = Permission::where('name', 'add_appointments')
            ->where('guard_name', 'web')
            ->first();

        if (!$payments || !$addAppointments) {
            return;
        }

        $roleIds = DB::table('role_has_permissions')
            ->where('permission_id', $addAppointments->id)
            ->pluck('role_id');

        foreach ($roleIds as $roleId) {
            DB::table('role_has_permissions')->updateOrInsert(
                ['permission_id' => $payments->id, 'role_id' => $roleId],
                ['permission_id' => $payments->id, 'role_id' => $roleId]
            );
        }
    }
}
