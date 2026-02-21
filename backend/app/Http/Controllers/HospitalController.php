<?php

namespace App\Http\Controllers;

use App\Models\Hospital;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class HospitalController extends Controller
{
    public function myHospital(Request $request)
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        if ($user->role === 'super_admin') {
            // Super admin can switch hospitals from the directory; this endpoint isn't required.
            return response()->json(null);
        }

        if (!$user->hospital_id) {
            return response()->json(['message' => 'No hospital assigned'], 404);
        }

        $hospital = Hospital::query()->findOrFail($user->hospital_id);
        return response()->json($this->withLogoUrl($hospital));
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $query = Hospital::query();

        // Non-super-admin users can only view their own hospital.
        if ($user && $user->role !== 'super_admin') {
            if (!$user->hospital_id) {
                return response()->json([]);
            }
            $query->whereKey($user->hospital_id);
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $hospitals = $query->orderBy('name')->get()->map(fn ($hospital) => $this->withLogoUrl($hospital));

        return response()->json($hospitals);
    }

    public function store(Request $request)
    {
        $this->authorizeHospitalAction($request->user(), 'add_hospitals');

                $data = $this->validatePayload($request);
                $data['slug'] = $data['slug'] ?? Str::slug($data['name']);

                if ($request->hasFile('logo')) {
                    $data['logo_path'] = $request->file('logo')->store('logos', 'public');
                }

                $hospital = Hospital::create($data);

                return response()->json($this->withLogoUrl($hospital), 201);
    }

    public function show(Hospital $hospital)
    {
        $user = request()->user();
        if ($user && $user->role !== 'super_admin') {
            if (!$user->hospital_id || (int) $user->hospital_id !== (int) $hospital->id) {
                abort(403, 'Forbidden');
            }
        }
        return response()->json($this->withLogoUrl($hospital));
    }

    public function update(Request $request, Hospital $hospital)
    {
        $this->authorizeHospitalAction($request->user(), 'edit_hospitals');

        $data = $this->validatePayload($request, $hospital->id);

        if ($request->hasFile('logo')) {
            $data['logo_path'] = $request->file('logo')->store('logos', 'public');
        }

        $hospital->update($data);

        return response()->json($this->withLogoUrl($hospital->fresh()));
    }

    public function destroy(Request $request, Hospital $hospital)
    {
        $this->authorizeHospitalAction($request->user(), 'delete_hospitals');

        $hospital->delete();

        return response()->json(['message' => 'Hospital deleted']);
    }

    private function authorizeHospitalAction($user, string $permission): void
    {
        $this->ensureAnyPermission(
            $user,
            [$permission, 'manage_hospitals'],
            'Only users with hospital permissions can manage hospitals'
        );
    }

    private function validatePayload(Request $request, ?int $hospitalId = null): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'slug' => ['sometimes', 'string', 'max:255', 'unique:hospitals,slug,' . ($hospitalId ?? 'NULL')],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:255'],
            'address' => ['nullable', 'string'],
            'logo' => ['nullable', 'image', 'max:2048'],
            'settings' => ['nullable', 'array'],
            'subscription_status' => ['sometimes', 'in:active,inactive,past_due'],
            'code' => ['nullable', 'string', 'max:64', 'unique:hospitals,code,' . ($hospitalId ?? 'NULL')],
            'license' => ['nullable', 'string', 'max:255'],
            'license_issue_date' => ['nullable', 'date'],
            'license_expiry_date' => ['nullable', 'date'],
            'status' => ['required', 'in:active,suspended'],
            'brand_color' => ['nullable', 'string', 'max:32'],
        ]);
    }

    private function withLogoUrl(Hospital $hospital): Hospital
    {
        $hospital->logo_url = $hospital->logo_path
            ? url(Storage::url($hospital->logo_path))
            : null;
        return $hospital;
    }
}
