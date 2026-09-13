<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Set Fee, Take Payment and Return Payment on each radiology and dental desk.
 *
 * SET FEE. Only Ultrasound could stop a clerk typing their own price. X-Ray,
 * ECG and Dental accepted whatever fee the form sent, so anyone who could raise
 * a receipt could reprice it. Without the new right the fee is the catalogue
 * price, enforced on the server.
 *
 * NOT backfilled, deliberately: granting it to everyone who can raise a receipt
 * would change nothing, and "the counter can no longer edit the price" is the
 * point of adding it.
 *
 * TAKE / RETURN PAYMENT. The Take Payment button on a desk was shown to anyone
 * holding the Accounts collection right OR the right to manage that desk's
 * records -- so a radiologist who could manage exams could also collect, and
 * did: ninety of one hospital's ultrasound payments are recorded under a
 * radiologist's name. Collecting at the desk is now its own right, separate
 * from managing the records and from the Accounts > Payment Collection right,
 * which keeps working exactly as before.
 *
 * Backfilled ONLY from the Accounts collection right: a role that could already
 * collect for this desk through Payment Collection keeps its desk button, and a
 * role that could collect merely because it managed the records loses it.
 * Return Payment is backfilled from Reverse Payment the same way.
 *
 * ECG. Its permissions move from their own tab to Radiology, beside Ultrasound
 * and X-Ray -- the three are one department on the sidebar.
 *
 * Permission rows and role grants only. No receipt, exam or payment is touched.
 */
return new class extends Migration
{
    /** name => [display, description, category] */
    private const PERMISSIONS = [
        'set_xray_fee' => ['Set X-Ray Fee', 'Change the fee on an X-Ray receipt; without it the catalogue price applies', 'Radiology'],
        'set_ecg_fee' => ['Set ECG Fee', 'Change the fee on an ECG receipt; without it the catalogue price applies', 'Radiology'],
        'set_dental_fee' => ['Set Dental Fee', 'Change the fee on a dental receipt; without it the catalogue price applies', 'Dental'],

        'take_ultrasound_payment' => ['Take Ultrasound Payment', 'Collect payment from the Ultrasound desk itself', 'Ultrasound'],
        'return_ultrasound_payment' => ['Return Ultrasound Payment', 'Mark a paid ultrasound receipt unpaid from the desk itself', 'Ultrasound'],
        'take_xray_payment' => ['Take X-Ray Payment', 'Collect payment from the X-Ray desk itself', 'Radiology'],
        'return_xray_payment' => ['Return X-Ray Payment', 'Mark a paid X-Ray receipt unpaid from the desk itself', 'Radiology'],
        'take_ecg_payment' => ['Take ECG Payment', 'Collect payment from the ECG desk itself', 'Radiology'],
        'return_ecg_payment' => ['Return ECG Payment', 'Mark a paid ECG receipt unpaid from the desk itself', 'Radiology'],
        'take_dental_payment' => ['Take Dental Payment', 'Collect payment from the Dental desk itself', 'Dental'],
        'return_dental_payment' => ['Return Dental Payment', 'Mark a paid dental receipt unpaid from the desk itself', 'Dental'],
    ];

    /** new desk right => the Accounts right whose holders keep the desk button */
    private const BACKFILL_FROM = [
        'take_ultrasound_payment' => 'manage_ultrasound_payments',
        'return_ultrasound_payment' => 'reverse_ultrasound_payment',
        'take_xray_payment' => 'manage_xray_payments',
        'return_xray_payment' => 'reverse_xray_payment',
        'take_ecg_payment' => 'manage_ecg_payments',
        'return_ecg_payment' => 'reverse_ecg_payment',
        'take_dental_payment' => 'manage_dental_payments',
        'return_dental_payment' => 'reverse_dental_payment',
    ];

    public function up(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        foreach (self::PERMISSIONS as $name => [$display, $description, $category]) {
            if (DB::table('permissions')->where('name', $name)->exists()) {
                continue;
            }

            DB::table('permissions')->insert([
                'name' => $name,
                'guard_name' => 'web',
                'display_name' => $display,
                'category' => $category,
                'description' => $description,
                'status' => 'active',
                'is_system' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        if (Schema::hasTable('role_has_permissions')) {
            foreach (self::BACKFILL_FROM as $target => $source) {
                $this->grantToHoldersOf($source, $target);
            }
        }

        // The ECG desk's own rights join the Radiology tab. Dashboard and
        // Accounts rights about ECG stay with their siblings.
        DB::table('permissions')
            ->where('category', 'ECG')
            ->update(['category' => 'Radiology', 'updated_at' => now()]);
    }

    private function grantToHoldersOf(string $source, string $target): void
    {
        $sourceId = DB::table('permissions')->where('name', $source)->value('id');
        $targetId = DB::table('permissions')->where('name', $target)->value('id');

        if (!$sourceId || !$targetId) {
            return;
        }

        $already = DB::table('role_has_permissions')->where('permission_id', $targetId)->pluck('role_id')->all();

        $rows = DB::table('role_has_permissions')
            ->where('permission_id', $sourceId)
            ->pluck('role_id')
            ->reject(fn ($roleId) => in_array($roleId, $already))
            ->map(fn ($roleId) => ['role_id' => $roleId, 'permission_id' => $targetId])
            ->values()
            ->all();

        if ($rows) {
            DB::table('role_has_permissions')->insert($rows);
        }
    }

    public function down(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        $ecgDeskRights = [
            'view_ecg_services', 'add_ecg_services', 'edit_ecg_services', 'delete_ecg_services', 'manage_ecg_services',
            'view_ecg_receipts', 'add_ecg_receipts', 'edit_ecg_receipts', 'delete_ecg_receipts', 'manage_ecg_receipts',
            'print_ecg_receipt',
        ];

        DB::table('permissions')->whereIn('name', $ecgDeskRights)->update(['category' => 'ECG', 'updated_at' => now()]);

        $ids = DB::table('permissions')->whereIn('name', array_keys(self::PERMISSIONS))->pluck('id');

        if ($ids->isNotEmpty() && Schema::hasTable('role_has_permissions')) {
            DB::table('role_has_permissions')->whereIn('permission_id', $ids)->delete();
        }

        DB::table('permissions')->whereIn('name', array_keys(self::PERMISSIONS))->delete();
    }
};
