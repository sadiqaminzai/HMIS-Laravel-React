<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use App\Models\Role;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Spatie\Permission\PermissionRegistrar;

class RoleController extends Controller
{
    public function index(Request $request)
    {
        $actor = $request->user();
        $query = Role::query()->with('permissions');

        $teamId = null;

        if ($actor && $actor->role !== 'super_admin') {
            $query->where('hospital_id', $actor->hospital_id);
            $teamId = $actor->hospital_id;
        } elseif ($request->filled('hospital_id')) {
            $query->where('hospital_id', $request->integer('hospital_id'));
            $teamId = $request->integer('hospital_id');
        }

        app(PermissionRegistrar::class)->setPermissionsTeamId($teamId);

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
        $this->authorizeRoleAction($request->user(), ['add_roles', 'manage_roles']);

        $actor = $request->user();
        $hospitalId = $actor->role === 'super_admin'
            ? $request->input('hospital_id')
            : $actor->hospital_id;

        if (!$hospitalId) {
            return response()->json(['message' => 'hospital_id is required'], 422);
        }

        $guardName = 'web';

        $data = $request->validate([
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('roles', 'name')->where(fn ($q) => $q->where('hospital_id', $hospitalId)->where('guard_name', $guardName)),
            ],
            'display_name' => ['required', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
            'is_system' => ['boolean'],
            'hospital_id' => ['nullable', 'integer', 'exists:hospitals,id'],
            'permission_ids' => ['array'],
            'permission_ids.*' => ['integer', 'exists:permissions,id'],
        ]);

        $data['hospital_id'] = (int) $hospitalId;
        $data['is_system'] = false;

        if ($data['name'] === 'super_admin') {
            return response()->json(['message' => 'Reserved role name'], 422);
        }

        $data['guard_name'] = $guardName;

        $role = Role::create($data);

        app(PermissionRegistrar::class)->setPermissionsTeamId($hospitalId);
        if (!empty($data['permission_ids'])) {
            $permissions = Permission::query()->whereIn('id', $data['permission_ids'])->get();
            $role->syncPermissions($permissions);
        }

        return response()->json($role->load('permissions'), 201);
    }

    public function show(Role $role)
    {
        $actor = request()->user();
        if ($actor && $actor->role !== 'super_admin' && (int) $role->hospital_id !== (int) $actor->hospital_id) {
            return response()->json(['message' => 'Not authorized'], 403);
        }
        app(PermissionRegistrar::class)->setPermissionsTeamId($role->hospital_id);
        return response()->json($role->load('permissions'));
    }

    public function update(Request $request, Role $role)
    {
        $this->authorizeRoleAction($request->user(), ['edit_roles', 'manage_roles']);


        $actor = $request->user();
        if ($actor && $actor->role !== 'super_admin' && (int) $role->hospital_id !== (int) $actor->hospital_id) {
            return response()->json(['message' => 'Not authorized'], 403);
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
            app(PermissionRegistrar::class)->setPermissionsTeamId($role->hospital_id);
            $permissions = Permission::query()->whereIn('id', $data['permission_ids'] ?? [])->get();
            $role->syncPermissions($permissions);
        }

        return response()->json($role->fresh()->load('permissions'));
    }

    public function destroy(Request $request, Role $role)
    {
        $this->authorizeRoleAction($request->user(), ['delete_roles', 'manage_roles']);

        $actor = $request->user();
        if ($actor && $actor->role !== 'super_admin' && (int) $role->hospital_id !== (int) $actor->hospital_id) {
            return response()->json(['message' => 'Not authorized'], 403);
        }


        $role->syncPermissions([]);
        $role->delete();

        return response()->json(['message' => 'Role deleted']);
    }

    private function authorizeRoleAction($user, array $permissions): void
    {
        $this->ensureAnyPermission($user, $permissions, 'Not authorized to manage roles');
    }
}
