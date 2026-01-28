<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $doctorUsers = DB::table('users')
            ->where('role', 'doctor')
            ->whereNotNull('hospital_id')
            ->get();

        foreach ($doctorUsers as $user) {
            $doctorId = $user->doctor_id ?? null;
            $doctor = null;

            if ($doctorId) {
                $doctor = DB::table('doctors')->where('id', $doctorId)->first();
            }

            if (!$doctor) {
                $doctorId = DB::table('doctors')->insertGetId([
                    'hospital_id' => $user->hospital_id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'specialization' => $user->specialization ?: 'General',
                    'registration_number' => $user->registration_number,
                    'consultation_fee' => $user->consultation_fee ?? 0,
                    'status' => $user->doctor_status ?? 'active',
                    'availability_schedule' => $user->availability_schedule,
                    'image_path' => $user->image_path,
                    'signature_path' => $user->signature_path,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            } else {
                DB::table('doctors')
                    ->where('id', $doctorId)
                    ->update([
                        'hospital_id' => $user->hospital_id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'phone' => $user->phone,
                        'specialization' => $user->specialization ?: 'General',
                        'registration_number' => $user->registration_number,
                        'consultation_fee' => $user->consultation_fee ?? 0,
                        'status' => $user->doctor_status ?? 'active',
                        'availability_schedule' => $user->availability_schedule,
                        'image_path' => $user->image_path,
                        'signature_path' => $user->signature_path,
                        'updated_at' => now(),
                    ]);
            }

            if (empty($user->doctor_id) || (int) $user->doctor_id !== (int) $doctorId) {
                DB::table('users')
                    ->where('id', $user->id)
                    ->update(['doctor_id' => $doctorId]);
            }
        }
    }

    public function down(): void
    {
        // No rollback for data backfill.
    }
};
