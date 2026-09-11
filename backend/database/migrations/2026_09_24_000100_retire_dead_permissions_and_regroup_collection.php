<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Retire the permissions whose screens are gone, and file cash collection
 * under Accounts.
 *
 * DELETED -- each was checked against the whole codebase first and is
 * referenced nowhere outside the roles screen that lists it:
 *
 *   view/delete/export/import/print_discounts
 *       The standalone Discounts screen under Reception was removed. Its CRUD
 *       rights have nothing left to guard.
 *   view_finance_menu
 *       The Finance menu no longer exists; its pages live under Accounts.
 *   export_finance, print_finance
 *       Belonged to the Pharmacy Finance screen, which was replaced by Payment
 *       Collection.
 *
 * DELIBERATELY KEPT, despite the Discounts and Finance menus being gone --
 * these are NOT screen rights, they gate capabilities that are still enforced:
 *
 *   add_discounts / edit_discounts / manage_discounts
 *       Checked by HandlesReceiptDiscounts and by the appointment, surgery,
 *       x-ray and dental controllers to decide whether a user may discount a
 *       receipt at all. Dropping them would silently strip discounts from every
 *       receipt for everyone who is not a super admin.
 *   view_finance_sales / _purchases / _sales_returns / _purchase_returns
 *       PharmacyFinanceController::authorizeDocument requires the matching one
 *       before it will settle a pharmacy invoice, so Payment Collection would
 *       stop being able to take pharmacy money without them.
 *
 * RECATEGORISED: cash collection and pharmacy settlement move to Accounts,
 * which is the menu those screens now live under. Label only -- no role loses
 * or gains anything.
 */
return new class extends Migration
{
    private const DELETE = [
        'view_discounts',
        'delete_discounts',
        'export_discounts',
        'import_discounts',
        'print_discounts',
        'view_finance_menu',
        'export_finance',
        'print_finance',
    ];

    /** Everything reachable from Accounts > Payment Collection. */
    private const TO_ACCOUNTS = [
        'manage_appointment_payments',
        'manage_lab_payments',
        'manage_ultrasound_payments',
        'manage_xray_payments',
        'manage_surgery_payments',
        'manage_room_booking_payments',
        'manage_dental_payments',
        'record_finance_payments',
        'reverse_appointment_payment',
        'reverse_lab_payment',
        'reverse_ultrasound_payment',
        'reverse_xray_payment',
        'reverse_surgery_payment',
        'reverse_room_booking_payment',
        'reverse_dental_payment',
        'reverse_finance_payment',
        'view_finance_sales',
        'view_finance_purchases',
        'view_finance_sales_returns',
        'view_finance_purchase_returns',
        'edit_finance_payment_status',
        'manage_finance',
    ];

    public function up(): void
    {
        if (!Schema::hasTable('permissions')) {
            return;
        }

        // Role assignments go first, or the pivot keeps rows pointing at
        // permissions that no longer exist.
        if (Schema::hasTable('permission_role')) {
            $ids = DB::table('permissions')->whereIn('name', self::DELETE)->pluck('id');

            if ($ids->isNotEmpty()) {
                DB::table('permission_role')->whereIn('permission_id', $ids)->delete();
            }
        }

        DB::table('permissions')->whereIn('name', self::DELETE)->delete();

        if (Schema::hasColumn('permissions', 'category')) {
            DB::table('permissions')
                ->whereIn('name', self::TO_ACCOUNTS)
                ->update(['category' => 'Accounts', 'updated_at' => now()]);
        }
    }

    /**
     * The deletions are not recreated.
     *
     * Rolling back would put eight checkboxes back on the roles screen for
     * screens that no longer exist, and no role would hold them anyway -- the
     * assignments were deleted with them. Only the recategorisation is undone,
     * which is the part that is genuinely reversible.
     */
    public function down(): void
    {
        if (!Schema::hasTable('permissions') || !Schema::hasColumn('permissions', 'category')) {
            return;
        }

        DB::table('permissions')
            ->whereIn('name', ['view_finance_sales', 'view_finance_purchases',
                'view_finance_sales_returns', 'view_finance_purchase_returns',
                'edit_finance_payment_status', 'manage_finance'])
            ->update(['category' => 'Pharmacy Finance', 'updated_at' => now()]);

        DB::table('permissions')
            ->whereIn('name', array_diff(self::TO_ACCOUNTS, [
                'view_finance_sales', 'view_finance_purchases',
                'view_finance_sales_returns', 'view_finance_purchase_returns',
                'edit_finance_payment_status', 'manage_finance',
            ]))
            ->update(['category' => 'Cash Collection', 'updated_at' => now()]);
    }
};
