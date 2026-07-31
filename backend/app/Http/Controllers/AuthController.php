<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Services\AuditLogger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\PermissionRegistrar;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        $user = User::with('hospital')->where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            AuditLogger::log([
                'user' => $user,
                'hospital_id' => $user->hospital_id ?? null,
                'module' => 'Authentication',
                'action' => 'login_failed',
                'record_id' => $user->id ?? null,
                'record_label' => $credentials['email'],
                'description' => 'Failed login attempt for '.$credentials['email'],
            ]);

            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        if (! $user->is_active) {
            AuditLogger::log([
                'user' => $user,
                'module' => 'Authentication',
                'action' => 'login_failed',
                'record_id' => $user->id,
                'record_label' => $user->email,
                'description' => 'Login blocked: account is inactive.',
            ]);

            return response()->json(['message' => 'Account is inactive. Contact an administrator.'], 403);
        }

        if ($user->hospital && $user->hospital->subscription_status !== 'active') {
            AuditLogger::log([
                'user' => $user,
                'module' => 'Authentication',
                'action' => 'login_failed',
                'record_id' => $user->id,
                'record_label' => $user->email,
                'description' => 'Login blocked: hospital subscription is not active.',
            ]);

            return response()->json(['message' => 'Hospital subscription is not active.'], 403);
        }

        // Rotate existing tokens to avoid token sprawl per user.
        $user->tokens()->delete();

        $user->loadMissing('roleRecord.permissions');
        $abilities = array_values(array_unique(array_merge([$user->role], $user->permissionNames())));

        $token = $user->createToken('auth_token', $abilities)->plainTextToken;

        $user->forceFill(['last_login_at' => now()])->save();

        AuditLogger::log([
            'user' => $user,
            'module' => 'Authentication',
            'action' => 'login',
            'record_id' => $user->id,
            'record_label' => $user->email,
            'description' => 'User signed in.',
        ]);

        return response()->json([
            'token' => $token,
            'token_type' => 'Bearer',
            'user' => $this->transformUser($user),
        ]);
    }

    public function me(Request $request)
    {
        return response()->json([
            'user' => $this->transformUser($request->user()->loadMissing('hospital', 'roleRecord')),
        ]);
    }

    public function logout(Request $request)
    {
        $user = $request->user();

        AuditLogger::log([
            'user' => $user,
            'module' => 'Authentication',
            'action' => 'logout',
            'record_id' => $user->id,
            'record_label' => $user->email,
            'description' => 'User signed out.',
        ]);

        if ($user->currentAccessToken()) {
            $user->currentAccessToken()->delete();
        }

        return response()->json(['message' => 'Logged out']);
    }

    private function transformUser(User $user): array
    {
        if ($user->role !== 'super_admin') {
            app(PermissionRegistrar::class)->setPermissionsTeamId($user->hospital_id);
        } else {
            app(PermissionRegistrar::class)->setPermissionsTeamId(null);
        }

        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'roleId' => $user->role_id ? (string) $user->role_id : null,
            'hospitalId' => $user->hospital_id ? (string) $user->hospital_id : null,
            'doctorId' => $user->role === 'doctor' ? (string) $user->id : null,
            'avatarPath' => $user->avatar_path,
            'isActive' => $user->is_active,
            'lastLoginAt' => $user->last_login_at,
            'permissions' => $user->permissionNames(),
            'hospital' => $user->hospital ? [
                'id' => (string) $user->hospital->id,
                'name' => $user->hospital->name,
                'slug' => $user->hospital->slug,
                'subscriptionStatus' => $user->hospital->subscription_status,
            ] : null,
        ];
    }
}
