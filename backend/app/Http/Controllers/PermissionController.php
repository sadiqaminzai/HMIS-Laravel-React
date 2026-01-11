<?php

namespace App\Http\Controllers;

use App\Models\Permission;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PermissionController extends Controller
{
    public function index(Request $request)
    {
        $query = Permission::query();

        if ($request->filled('category')) {
            $query->where('category', $request->string('category'));
        }

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

        return response()->json($query->paginate(100));
    }

    public function store(Request $request)
    {
        $this->authorizeManagePermissions($request->user());

        $data = $request->validate([
            'name' => ['required', 'string', 'max:255', 'unique:permissions,name'],
            'display_name' => ['required', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'status' => ['required', Rule::in(['active', 'inactive'])],
            'is_system' => ['boolean'],
        ]);

        $permission = Permission::create($data);

        return response()->json($permission, 201);
    }

    public function show(Permission $permission)
    {
        return response()->json($permission);
    }

    public function update(Request $request, Permission $permission)
    {
        $this->authorizeManagePermissions($request->user());

        if ($permission->is_system) {
            return response()->json(['message' => 'System permissions cannot be modified'], 403);
        }

        $data = $request->validate([
            'display_name' => ['sometimes', 'string', 'max:255'],
            'category' => ['sometimes', 'string', 'nullable', 'max:255'],
            'description' => ['sometimes', 'string', 'nullable'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
        ]);

        $permission->update($data);

        return response()->json($permission->fresh());
    }

    public function destroy(Request $request, Permission $permission)
    {
        $this->authorizeManagePermissions($request->user());

        if ($permission->is_system) {
            return response()->json(['message' => 'System permissions cannot be deleted'], 403);
        }

        $permission->roles()->detach();
        $permission->delete();

        return response()->json(['message' => 'Permission deleted']);
    }

    private function authorizeManagePermissions($user): void
    {
        if (! $user || ! $user->hasPermission('manage_permissions')) {
            abort(403, 'Not authorized to manage permissions');
        }
    }
}
