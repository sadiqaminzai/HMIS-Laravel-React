<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

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
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        if (! $user->is_active) {
            return response()->json(['message' => 'Account is inactive. Contact an administrator.'], 403);
        }

        if ($user->hospital && $user->hospital->subscription_status !== 'active') {
            return response()->json(['message' => 'Hospital subscription is not active.'], 403);
        }

        // Rotate existing tokens to avoid token sprawl per user.
        $user->tokens()->delete();

        $user->loadMissing('roleRecord.permissions');
        $abilities = array_values(array_unique(array_merge([$user->role], $user->permissionNames())));

        $token = $user->createToken('auth_token', $abilities)->plainTextToken;

        $user->forceFill(['last_login_at' => now()])->save();

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
        if ($request->user()->currentAccessToken()) {
            $request->user()->currentAccessToken()->delete();
        }

        return response()->json(['message' => 'Logged out']);
    }

    private function transformUser(User $user): array
    {
        return [
            'id' => (string) $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
            'roleId' => $user->role_id ? (string) $user->role_id : null,
            'hospitalId' => $user->hospital_id ? (string) $user->hospital_id : null,
            'doctorId' => $user->doctor_id ? (string) $user->doctor_id : null,
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
