<?php

namespace App\Http\Controllers;

use App\Models\Doctor;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class DoctorController extends Controller
{
    public function index(Request $request)
    {
        $query = Doctor::query();

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

        $doctors = $query->orderBy('name')->get()->map(fn ($doctor) => $this->withMediaUrls($doctor));

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

        $doctor = Doctor::create($data);

        return response()->json($this->withMediaUrls($doctor), 201);
    }

    public function show(Request $request, Doctor $doctor)
    {
        $this->authorizeScope($request->user(), $doctor);
        return response()->json($this->withMediaUrls($doctor));
    }

    public function update(Request $request, Doctor $doctor)
    {
        $this->authorizeReceptionOrAbove($request->user());
        $this->authorizeScope($request->user(), $doctor);

        $data = $this->validatePayload($request, $doctor->id);

        if ($request->hasFile('image')) {
            $data['image_path'] = $request->file('image')->store('doctors/images', 'public');
        }

        if ($request->hasFile('signature')) {
            $data['signature_path'] = $request->file('signature')->store('doctors/signatures', 'public');
        }

        $doctor->update($data);

        return response()->json($this->withMediaUrls($doctor->fresh()));
    }

    public function destroy(Request $request, Doctor $doctor)
    {
        $this->authorizeReceptionOrAbove($request->user());
        $this->authorizeScope($request->user(), $doctor);

        $doctor->delete();

        return response()->json(['message' => 'Doctor deleted']);
    }

    private function authorizeReceptionOrAbove($user): void
    {
        if (!in_array($user->role, ['receptionist', 'admin', 'super_admin'])) {
            abort(403, 'Only receptionists, admins or super admins can manage doctors');
        }
    }

    private function authorizeScope($user, Doctor $doctor): void
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

    private function withMediaUrls(Doctor $doctor): Doctor
    {
        $doctor->image_url = $doctor->image_path ? url(Storage::url($doctor->image_path)) : null;
        $doctor->signature_url = $doctor->signature_path ? url(Storage::url($doctor->signature_path)) : null;
        return $doctor;
    }
}
