<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = User::query()->with('hospital');

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
            'role' => ['required', Rule::in(['super_admin', 'admin', 'doctor', 'receptionist', 'pharmacist', 'lab_technician'])],
            'hospital_id' => ['nullable', 'integer', 'exists:hospitals,id'],
            'doctor_id' => ['nullable', 'integer', 'exists:doctors,id'],
            'avatar_path' => ['nullable', 'string'],
            'is_active' => ['boolean'],
        ]);

        if ($actor->role !== 'super_admin') {
            $data['hospital_id'] = $actor->hospital_id;
            if ($data['role'] === 'super_admin') {
                return response()->json(['message' => 'Not authorized to create super admins'], 403);
            }
        }

        $user = User::create($data);

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
            'role' => ['sometimes', Rule::in(['super_admin', 'admin', 'doctor', 'receptionist', 'pharmacist', 'lab_technician'])],
            'hospital_id' => ['nullable', 'integer', 'exists:hospitals,id'],
            'doctor_id' => ['nullable', 'integer', 'exists:doctors,id'],
            'avatar_path' => ['nullable', 'string'],
            'is_active' => ['boolean'],
        ]);

        $actor = $request->user();

        if ($actor->role !== 'super_admin') {
            $data['hospital_id'] = $actor->hospital_id;
            if (isset($data['role']) && $data['role'] === 'super_admin') {
                return response()->json(['message' => 'Not authorized to assign super_admin role'], 403);
            }
        }

        // Clear doctor link if role not doctor
        if (isset($data['role']) && $data['role'] !== 'doctor') {
            $data['doctor_id'] = null;
        }

        $user->update($data);

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
}
