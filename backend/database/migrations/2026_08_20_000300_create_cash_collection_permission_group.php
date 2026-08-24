<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Gather every "take the money" right into one assignable group.
 *
 * Cash handling differs per hospital: one site puts all collection on a single
 * trustee, another gives the pharmacy its own cashier and leaves OPD fees with
 * reception. That is a configuration question, so it has to be answered by
 * ticking permissions rather than by code.
 *
 * Until now the payment rights were scattered across five categories, and two
 * modules had none at all -- surgery payments rode on "can edit surgeries" and
 * room bookings on "can edit bookings", so they could not be withheld from the
 * clerk who has to create them.
 *
 * This migration:
 *   1. creates the two missing pairs (surgery, room booking);
 *   2. moves the existing payment permissions into a Cash Collection category
 *      so a cashier role is configured from one group on the Roles screen.
 *
 * Names of existing permissions are deliberately NOT changed -- renaming would
 * silently strip the right from every role that already holds it. Only the
 * category moves.
 *
 * Nothing is granted here. Who collects is the hospital's decision, made on the
 * Roles screen; a migration that handed out cash rights by itself would be a
 * privilege escalation nobody asked for.
 */
return new class extends Migration
{
    private const CATEGORY = 'Cash Collection';

    /** name => display name, for permissions that do not exist yet. */
    private const NEW_PERMISSIONS = [
        'manage_surgery_payments' => 'Take Surgery Payments',
        'reverse_surgery_payment' => 'Reverse Surgery Payment (Paid to Pending)',
        'manage_room_booking_payments' => 'Take Room Booking Payments',
        'reverse_room_booking_payment' => 'Reverse Room Booking Payment (Paid to Pending)',
        // Created by AppointmentPaymentPermissionsSeeder, which cannot be run on
        // a live database because the seeders truncate users.
        'reverse_appointment_payment' => 'Reverse Appointment Payment (Paid to Pending)',
    ];

    /** Existing permissions that belong in the group. */
    private const REGROUPED = [
        'manage_appointment_payments',
        'reverse_appointment_payment',
        'manage_lab_payments',
        'reverse_lab_payment',
        'manage_ultrasound_payments',
        'reverse_ultrasound_payment',
        'record_finance_payments',
        'reverse_finance_payment',
        'manage_surgery_payments',
        'reverse_surgery_payment',
        'manage_room_booking_payments',
        'reverse_room_booking_payment',
    ];

    public function up(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        $now = now();

        foreach (self::NEW_PERMISSIONS as $name => $displayName) {
            $exists = DB::table('permissions')->where('name', $name)->exists();
            if ($exists) {
                continue;
            }

            DB::table('permissions')->insert([
                'name' => $name,
                'guard_name' => 'web',
                'display_name' => $displayName,
                'category' => self::CATEGORY,
                'status' => 'active',
                'is_system' => 0,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        DB::table('permissions')
            ->whereIn('name', self::REGROUPED)
            ->update(['category' => self::CATEGORY, 'updated_at' => $now]);
    }

    public function down(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        // Put the regrouped permissions back where they came from. The two new
        // pairs are dropped; any role holding them loses them, which is correct
        // -- without the columns and endpoints from the sibling migrations there
        // is nothing for them to guard.
        $restore = [
            'Appointments' => ['manage_appointment_payments'],
            'Laboratory' => ['manage_lab_payments', 'reverse_lab_payment'],
            'Ultrasound' => ['manage_ultrasound_payments', 'reverse_ultrasound_payment'],
            'Pharmacy Finance' => ['record_finance_payments', 'reverse_finance_payment'],
        ];

        foreach ($restore as $category => $names) {
            DB::table('permissions')->whereIn('name', $names)->update(['category' => $category]);
        }

        $drop = array_keys(self::NEW_PERMISSIONS);
        $ids = DB::table('permissions')->whereIn('name', $drop)->pluck('id');

        if ($ids->isNotEmpty()) {
            if (Schema::hasTable('role_has_permissions')) {
                DB::table('role_has_permissions')->whereIn('permission_id', $ids)->delete();
            }
            if (Schema::hasTable('model_has_permissions')) {
                DB::table('model_has_permissions')->whereIn('permission_id', $ids)->delete();
            }
            DB::table('permissions')->whereIn('id', $ids)->delete();
        }
    }
};
