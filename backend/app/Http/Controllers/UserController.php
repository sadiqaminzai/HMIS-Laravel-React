<?php

namespace App\Http\Controllers;

use App\Models\Role;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Spatie\Permission\PermissionRegistrar;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = User::query()->with('hospital', 'roleRecord');

        if ($user->role !== 'super_admin') {
            $query->where('hospital_id', $user->hospital_id)
                ->where('role', '!=', 'super_admin');
        }

        if ($request->filled('role')) {
            $query->where('role', $request->string('role'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        if ($request->filled('hospital_id') && $user->role === 'super_admin') {
            $query->where('hospital_id', $request->integer('hospital_id'));
        }

        return response()->json($query->paginate(25));
    }

    public function store(Request $request)
    {
        $actor = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8'],
            'hospital_id' => ['nullable', 'integer', 'exists:hospitals,id'],
            'role_id' => ['required', 'integer', 'exists:roles,id'],
            'phone' => ['nullable', 'string', 'max:255'],
            'specialization' => ['nullable', 'string', 'max:255'],
            'registration_number' => ['nullable', 'string', 'max:255'],
            'consultation_fee' => ['nullable', 'numeric', 'min:0'],
            'doctor_status' => ['nullable', 'in:active,inactive'],
            'availability_schedule' => ['nullable', 'array'],
            'image_path' => ['nullable', 'string', 'max:255'],
            'signature_path' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ]);

        if ($actor->role !== 'super_admin') {
            $data['hospital_id'] = $actor->hospital_id;
        } else {
            // Super admin must explicitly choose a hospital for tenant users.
            if (empty($data['hospital_id'])) {
                return response()->json(['message' => 'hospital_id is required'], 422);
            }
        }

        // Enforce that the selected role belongs to the target hospital.
        $role = Role::query()->whereKey($data['role_id'])->first();
        if (!$role) {
            return response()->json(['message' => 'Invalid role'], 422);
        }
        if ((int) $role->hospital_id !== (int) $data['hospital_id']) {
            return response()->json(['message' => 'Role does not belong to this hospital'], 422);
        }
        if ($role->name === 'super_admin') {
            return response()->json(['message' => 'Not authorized to create super admins'], 403);
        }

        // Keep the legacy role string in sync for display/compat.
        $data['role'] = $role->name;

        // If not doctor, strip doctor-only fields.
        if ($data['role'] !== 'doctor') {
            $data['specialization'] = null;
            $data['registration_number'] = null;
            $data['consultation_fee'] = 0;
            $data['doctor_status'] = null;
            $data['availability_schedule'] = null;
            $data['image_path'] = null;
            $data['signature_path'] = null;
        } else {
            if (empty($data['availability_schedule'])) {
                $data['availability_schedule'] = $this->defaultAvailabilitySchedule();
            }
        }

        $user = User::create($data);

        app(PermissionRegistrar::class)->setPermissionsTeamId($data['hospital_id']);
        $user->syncRoles([$role]);

        return response()->json($user->load('hospital'), 201);
    }

    public function show(User $user, Request $request)
    {
        if (!$this->canAccessUser($request->user(), $user)) {
            return response()->json(['message' => 'Not authorized'], 403);
        }

        return response()->json($user->load('hospital'));
    }

    public function update(Request $request, User $user)
    {
        if (!$this->canAccessUser($request->user(), $user)) {
            return response()->json(['message' => 'Not authorized'], 403);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'password' => ['sometimes', 'string', 'min:8'],
            'hospital_id' => ['nullable', 'integer', 'exists:hospitals,id'],
            'role_id' => ['sometimes', 'integer', 'exists:roles,id'],
            'phone' => ['nullable', 'string', 'max:255'],
            'specialization' => ['nullable', 'string', 'max:255'],
            'registration_number' => ['nullable', 'string', 'max:255'],
            'consultation_fee' => ['nullable', 'numeric', 'min:0'],
            'doctor_status' => ['nullable', 'in:active,inactive'],
            'availability_schedule' => ['nullable', 'array'],
            'image_path' => ['nullable', 'string', 'max:255'],
            'signature_path' => ['nullable', 'string', 'max:255'],
            'is_active' => ['boolean'],
        ]);

        $actor = $request->user();

        if ($actor->role !== 'super_admin') {
            $data['hospital_id'] = $actor->hospital_id;
        } else if (array_key_exists('hospital_id', $data) && empty($data['hospital_id'])) {
            return response()->json(['message' => 'hospital_id is required'], 422);
        }

        if (isset($data['role_id'])) {
            $targetHospitalId = array_key_exists('hospital_id', $data) ? $data['hospital_id'] : $user->hospital_id;
            $role = Role::query()->whereKey($data['role_id'])->first();
            if (!$role) {
                return response()->json(['message' => 'Invalid role'], 422);
            }
            if ((int) $role->hospital_id !== (int) $targetHospitalId) {
                return response()->json(['message' => 'Role does not belong to this hospital'], 422);
            }
            if ($role->name === 'super_admin') {
                return response()->json(['message' => 'Not authorized to assign super_admin role'], 403);
            }

            $data['role'] = $role->name;
        }

        // Clear doctor fields if not a doctor.
        $roleName = array_key_exists('role', $data) ? (string) $data['role'] : (string) $user->role;
        if ($roleName !== 'doctor') {
            $data['specialization'] = null;
            $data['registration_number'] = null;
            $data['consultation_fee'] = 0;
            $data['doctor_status'] = null;
            $data['availability_schedule'] = null;
            $data['image_path'] = null;
            $data['signature_path'] = null;
        } else {
            if (empty($data['availability_schedule'])) {
                $data['availability_schedule'] = $user->availability_schedule ?: $this->defaultAvailabilitySchedule();
            }
        }

        $user->update($data);

        if (isset($role) && $role) {
            app(PermissionRegistrar::class)->setPermissionsTeamId($user->hospital_id);
            $user->syncRoles([$role]);
        }

        return response()->json($user->fresh()->load('hospital'));
    }

    public function destroy(User $user, Request $request)
    {
        if (!$this->canAccessUser($request->user(), $user)) {
            return response()->json(['message' => 'Not authorized'], 403);
        }

        $user->delete();

        return response()->json(['message' => 'User deleted']);
    }

    private function canAccessUser(User $actor, User $target): bool
    {
        if ($actor->role === 'super_admin') {
            return true;
        }

        return $actor->hospital_id === $target->hospital_id && $target->role !== 'super_admin';
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function defaultAvailabilitySchedule(): array
    {
        return [
            ['day' => 'Saturday', 'startTime' => '09:00', 'endTime' => '17:00', 'isAvailable' => true],
            ['day' => 'Sunday', 'startTime' => '09:00', 'endTime' => '17:00', 'isAvailable' => true],
            ['day' => 'Monday', 'startTime' => '09:00', 'endTime' => '17:00', 'isAvailable' => true],
            ['day' => 'Tuesday', 'startTime' => '09:00', 'endTime' => '17:00', 'isAvailable' => true],
            ['day' => 'Wednesday', 'startTime' => '09:00', 'endTime' => '17:00', 'isAvailable' => true],
            ['day' => 'Thursday', 'startTime' => '09:00', 'endTime' => '13:00', 'isAvailable' => true],
            ['day' => 'Friday', 'startTime' => '00:00', 'endTime' => '00:00', 'isAvailable' => false],
        ];
    }
}
