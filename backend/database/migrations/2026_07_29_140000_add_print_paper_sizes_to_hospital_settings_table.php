<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            // Per-document paper size map, e.g. {"pharmacy_sales_invoice":"80mm","patient_card":"a4"}.
            // Null means "use the defaults from config/print.php".
            $table->json('print_paper_sizes')->nullable()->after('print_show_bonus_column');
        });
    }

    public function down(): void
    {
        Schema::table('hospital_settings', function (Blueprint $table) {
            $table->dropColumn('print_paper_sizes');
        });
    }
};
