<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // No-op: hospitals table is created earlier in 2026_01_10_000000_create_hospitals_table.php
    }

    public function down(): void
    {
        // No-op
    }
};
