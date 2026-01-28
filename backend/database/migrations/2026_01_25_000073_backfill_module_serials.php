<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $modules = [
            ['table' => 'patients', 'column' => 'patient_id', 'module' => 'patient'],
            ['table' => 'appointments', 'column' => 'appointment_number', 'module' => 'appointment'],
            ['table' => 'prescriptions', 'column' => 'prescription_number', 'module' => 'prescription'],
            ['table' => 'lab_orders', 'column' => 'order_number', 'module' => 'lab'],
            ['table' => 'test_templates', 'column' => 'test_code', 'module' => 'test_template'],
            ['table' => 'doctors', 'column' => 'serial_no', 'module' => 'doctor'],
            ['table' => 'manufacturers', 'column' => 'serial_no', 'module' => 'manufacturer'],
            ['table' => 'medicine_types', 'column' => 'serial_no', 'module' => 'medicine_type'],
            ['table' => 'medicines', 'column' => 'serial_no', 'module' => 'medicine'],
            ['table' => 'stocks', 'column' => 'serial_no', 'module' => 'stock'],
            ['table' => 'stock_movements', 'column' => 'serial_no', 'module' => 'stock_movement'],
            ['table' => 'stock_reconciliations', 'column' => 'serial_no', 'module' => 'stock_reconciliation'],
            ['table' => 'suppliers', 'column' => 'serial_no', 'module' => 'supplier'],
            ['table' => 'roles', 'column' => 'serial_no', 'module' => 'role'],
            ['table' => 'users', 'column' => 'serial_no', 'module' => 'user'],
            ['table' => 'walk_in_patients', 'column' => 'serial_no', 'module' => 'walk_in_patient'],
            ['table' => 'hospital_settings', 'column' => 'serial_no', 'module' => 'hospital_setting'],
            ['table' => 'backup_settings', 'column' => 'serial_no', 'module' => 'backup_setting'],
            ['table' => 'contact_messages', 'column' => 'serial_no', 'module' => 'contact_message'],
            ['table' => 'transactions', 'column' => 'serial_no', 'module' => 'transaction'],
        ];

        foreach ($modules as $meta) {
            $table = $meta['table'];
            $column = $meta['column'];
            $module = $meta['module'];

            $hospitalIds = DB::table($table)
                ->whereNotNull('hospital_id')
                ->distinct()
                ->pluck('hospital_id');

            foreach ($hospitalIds as $hospitalId) {
                $rows = DB::table($table)
                    ->select('id', 'hospital_id', $column)
                    ->where('hospital_id', $hospitalId)
                    ->orderBy('id')
                    ->get();

                $max = 0;
                foreach ($rows as $row) {
                    $value = $row->{$column};
                    if (is_string($value) && ctype_digit($value)) {
                        $max = max($max, (int) $value);
                    } elseif (is_int($value) || is_numeric($value)) {
                        $max = max($max, (int) $value);
                    }
                }

                foreach ($rows as $row) {
                    $value = $row->{$column};
                    $isNumeric = is_string($value) ? ctype_digit($value) : is_numeric($value);
                    if ($value === null || $value === '' || !$isNumeric) {
                        $max++;
                        DB::table($table)
                            ->where('id', $row->id)
                            ->update([$column => (string) $max]);
                    }
                }

                $existing = DB::table('module_sequences')
                    ->where('hospital_id', $hospitalId)
                    ->where('module', $module)
                    ->first();

                if ($existing) {
                    DB::table('module_sequences')
                        ->where('id', $existing->id)
                        ->update([
                            'last_number' => $max,
                            'updated_at' => now(),
                        ]);
                } else {
                    DB::table('module_sequences')->insert([
                        'hospital_id' => $hospitalId,
                        'module' => $module,
                        'last_number' => $max,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        // No rollback for data backfill.
    }
};
