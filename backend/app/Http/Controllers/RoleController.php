<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class RoleController extends Controller
{
    public function index(Request $request)
    {
        $query = Role::query()->with('permissions');

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('search')) {
            $search = $request->string('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('display_name', 'like', "%{$search}%")
                    ->orWhere('description', 'like', "%{$search}%");
            });
        }

        return response()->json($query->paginate(50));
    }

    public function store(Request $request)
    {
        $this->authorizeSuperAdmin($request->user());

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:roles,name'],
            'display_name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
            'is_system' => ['boolean'],
            'permission_ids' => ['array'],
            'permission_ids.*' => ['integer', 'exists:permissions,id'],
        ]);

        $role = Role::create($data);

        if (!empty($data['permission_ids'])) {
            $role->permissions()->sync($data['permission_ids']);
        }

        return response()->json($role->load('permissions'), 201);
    }

    public function show(Role $role)
    {
        return response()->json($role->load('permissions'));
    }

    public function update(Request $request, Role $role)
    {
        $this->authorizeSuperAdmin($request->user());

        if ($role->is_system) {
            return response()->json(['message' => 'System roles cannot be modified'], 403);
        }

        $data = $request->validate([
            'display_name' => ['sometimes', 'string', 'max:255'],
            'description' => ['sometimes', 'string', 'nullable'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'permission_ids' => ['array'],
            'permission_ids.*' => ['integer', 'exists:permissions,id'],
        ]);

        $role->update($data);

        if ($request->has('permission_ids')) {
            $role->permissions()->sync($data['permission_ids'] ?? []);
        }

        return response()->json($role->fresh()->load('permissions'));
    }

    public function destroy(Request $request, Role $role)
    {
        $this->authorizeSuperAdmin($request->user());

        if ($role->is_system) {
            return response()->json(['message' => 'System roles cannot be deleted'], 403);
        }

        $role->permissions()->detach();
        $role->delete();

        return response()->json(['message' => 'Role deleted']);
    }

    private function authorizeSuperAdmin($user): void
    {
        if ($user->role !== 'super_admin') {
            abort(403, 'Only super admins can manage roles');
        }
    }
}
