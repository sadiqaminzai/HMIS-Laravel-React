<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A standing discount per revenue module, configured once per hospital.
 *
 * Some clinics announce a blanket reduction -- "30% off every surgery this
 * month" -- and reception was applying it by hand on every single receipt,
 * which is slow and gets forgotten. These columns seed the discount field on a
 * new receipt; the person raising it can still change or clear it if they hold
 * the discount permission.
 *
 * Stored as a percentage, not an amount: the announcement is a percentage, and
 * a fixed amount would be wrong the moment a price changes.
 */
return new class extends Migration
{
    private const COLUMNS = [
        'default_discount_surgery',
        'default_discount_lab',
        'default_discount_ultrasound',
        'default_discount_xray',
        'default_discount_dental',
    ];

    public function up(): void
    {
        if (!Schema::hasTable('hospital_settings')) {
            return;
        }

        Schema::table('hospital_settings', function (Blueprint $table) {
            $after = 'show_prescription_list_meta';
            foreach (self::COLUMNS as $column) {
                if (Schema::hasColumn('hospital_settings', $column)) {
                    continue;
                }
                // 0 means "no standing discount", which is what every existing
                // hospital gets -- this changes nothing until someone sets it.
                $table->decimal($column, 5, 2)->default(0)->after($after);
                $after = $column;
            }
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('hospital_settings')) {
            return;
        }

        $present = array_values(array_filter(
            self::COLUMNS,
            fn ($column) => Schema::hasColumn('hospital_settings', $column)
        ));

        if ($present) {
            Schema::table('hospital_settings', function (Blueprint $table) use ($present) {
                $table->dropColumn($present);
            });
        }
    }
};
