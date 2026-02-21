<?php

use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        // No-op: patient_id uses module_sequences, no serial_no needed.
    }

    public function down(): void
    {
        // No-op.
    }
};
