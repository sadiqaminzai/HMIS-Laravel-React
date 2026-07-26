<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->unsignedBigInteger('shift_id')->nullable()->after('designation_id');
            $table->foreign('shift_id')->references('id')->on('shifts')->nullOnDelete();
            $table->index(['hospital_id', 'shift_id']);
        });

        Schema::table('employee_attendances', function (Blueprint $table) {
            $table->unsignedBigInteger('shift_id')->nullable()->after('employee_id');
            $table->foreign('shift_id')->references('id')->on('shifts')->nullOnDelete();
            $table->index(['hospital_id', 'shift_id']);
        });
    }

    public function down(): void
    {
        Schema::table('employee_attendances', function (Blueprint $table) {
            $table->dropForeign(['shift_id']);
            $table->dropColumn('shift_id');
        });

        Schema::table('employees', function (Blueprint $table) {
            $table->dropForeign(['shift_id']);
            $table->dropColumn('shift_id');
        });
    }
};
