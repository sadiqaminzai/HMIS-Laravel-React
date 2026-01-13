<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class DoctorController extends Controller
{
    public function index(Request $request)
    {
        $query = User::query()->where('is_doctor', true);

        if ($request->user()->role !== 'super_admin') {
            $query->where('hospital_id', $request->user()->hospital_id);
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('specialization', 'like', "%{$search}%")
                    ->orWhere('registration_number', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $doctors = $query->orderBy('name')->get()->map(fn ($doctor) => $this->toDoctorShape($this->withMediaUrls($doctor)));

        return response()->json($doctors);
    }

    public function store(Request $request)
    {
        $this->authorizeReceptionOrAbove($request->user());

        $data = $this->validatePayload($request);

        if ($request->user()->role !== 'super_admin') {
            $data['hospital_id'] = $request->user()->hospital_id;
        }

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->store('doctors/images', 'public');
        }

        if ($request->hasFile('signature')) {
            $data['signature_path'] = $request->file('signature')->store('doctors/signatures', 'public');
        }

        // Doctors are users now; generate a password for the new account.
        $generatedPassword = Str::password(12);

        $user = User::create([
            'hospital_id' => $data['hospital_id'],
            'name' => $data['name'],
            'email' => $data['email'] ?? Str::uuid().'@example.invalid',
            'password' => $generatedPassword,
            'role' => 'doctor',
            'is_doctor' => true,
            'phone' => $data['phone'] ?? null,
            'specialization' => $data['specialization'] ?? null,
            'registration_number' => $data['registration_number'] ?? null,
            'consultation_fee' => $data['consultation_fee'] ?? 0,
            'doctor_status' => $data['status'] ?? 'active',
            'availability_schedule' => $data['availability_schedule'] ?? null,
            'image_path' => $data['image_path'] ?? null,
            'signature_path' => $data['signature_path'] ?? null,
            'is_active' => ($data['status'] ?? 'active') === 'active',
        ]);

        $payload = $this->toDoctorShape($this->withMediaUrls($user));
        $payload['generated_password'] = $generatedPassword;

        return response()->json($payload, 201);
    }

    public function show(Request $request, User $doctor)
    {
        if (!$doctor->is_doctor) {
            abort(404);
        }

        $this->authorizeScope($request->user(), $doctor);
        return response()->json($this->toDoctorShape($this->withMediaUrls($doctor)));
    }

    public function update(Request $request, User $doctor)
    {
        $this->authorizeReceptionOrAbove($request->user());
        $this->authorizeScope($request->user(), $doctor);

        if (!$doctor->is_doctor) {
            abort(404);
        }

        $data = $this->validatePayload($request, $doctor->id);

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->store('doctors/images', 'public');
        }

        if ($request->hasFile('signature')) {
            $data['signature_path'] = $request->file('signature')->store('doctors/signatures', 'public');
        }

        $doctor->update([
            'name' => $data['name'],
            'email' => $data['email'] ?? $doctor->email,
            'phone' => $data['phone'] ?? null,
            'specialization' => $data['specialization'] ?? null,
            'registration_number' => $data['registration_number'] ?? null,
            'consultation_fee' => $data['consultation_fee'] ?? 0,
            'doctor_status' => $data['status'] ?? 'active',
            'availability_schedule' => $data['availability_schedule'] ?? null,
            'image_path' => $data['image_path'] ?? $doctor->image_path,
            'signature_path' => $data['signature_path'] ?? $doctor->signature_path,
            'is_active' => ($data['status'] ?? 'active') === 'active',
        ]);

        return response()->json($this->toDoctorShape($this->withMediaUrls($doctor->fresh())));
    }

    public function destroy(Request $request, User $doctor)
    {
        $this->authorizeReceptionOrAbove($request->user());
        $this->authorizeScope($request->user(), $doctor);

        if (!$doctor->is_doctor) {
            abort(404);
        }

        $doctor->delete();

        return response()->json(['message' => 'Doctor deleted']);
    }

    private function authorizeReceptionOrAbove($user): void
    {
        if (!in_array($user->role, ['receptionist', 'admin', 'super_admin'])) {
            abort(403, 'Only receptionists, admins or super admins can manage doctors');
        }
    }

    private function authorizeScope($user, User $doctor): void
    {
        if ($user->role !== 'super_admin' && $user->hospital_id !== $doctor->hospital_id) {
            abort(403, 'Unauthorized doctor access');
        }
    }

    private function validatePayload(Request $request, ?int $doctorId = null): array
    {
        $data = $request->validate([
            'hospital_id' => ['sometimes', 'required', 'exists:hospitals,id'],
            'name' => ['required', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'specialization' => ['required', 'string', 'max:255'],
            'registration_number' => ['nullable', 'string', 'max:255'],
            'consultation_fee' => ['nullable', 'numeric', 'min:0'],
            'status' => ['required', 'in:active,inactive'],
            'availability_schedule' => ['nullable', 'array'],
            'availability_schedule.*.day' => ['required_with:availability_schedule', 'string'],
            'availability_schedule.*.startTime' => ['required_with:availability_schedule', 'string'],
            'availability_schedule.*.endTime' => ['required_with:availability_schedule', 'string'],
            'availability_schedule.*.isAvailable' => ['required_with:availability_schedule', 'boolean'],
            'image' => ['nullable', 'image', 'max:2048'],
            'signature' => ['nullable', 'image', 'max:2048'],
        ]);

        if (isset($data['availability_schedule']) && is_string($data['availability_schedule'])) {
            $decoded = json_decode($data['availability_schedule'], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $data['availability_schedule'] = $decoded;
            }
        }

        return $data;
    }

    private function withMediaUrls(User $doctor): User
    {
        $doctor->image_url = $doctor->image_path ? url(Storage::url($doctor->image_path)) : null;
        $doctor->signature_url = $doctor->signature_path ? url(Storage::url($doctor->signature_path)) : null;
        return $doctor;
    }

    /**
     * Keep response backward-compatible with the old Doctor model.
     */
    private function toDoctorShape(User $user): array
    {
        return [
            'id' => $user->id,
            'hospital_id' => $user->hospital_id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'specialization' => $user->specialization ?? '',
            'registration_number' => $user->registration_number,
            'consultation_fee' => $user->consultation_fee ?? 0,
            'status' => $user->doctor_status ?? ($user->is_active ? 'active' : 'inactive'),
            'availability_schedule' => $user->availability_schedule,
            'image_path' => $user->image_path,
            'signature_path' => $user->signature_path,
            'image_url' => $user->image_url ?? null,
            'signature_url' => $user->signature_url ?? null,
            'created_at' => $user->created_at,
            'updated_at' => $user->updated_at,
        ];
    }
}
