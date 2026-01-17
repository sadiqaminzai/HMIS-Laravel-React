<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class RequirePermissionOrDoctor
{
    /**
      * Allows access when either:
      * - user is a doctor (role=doctor), OR
     * - user has any of the provided permissions.
     *
     * @param  array<int, string>  $permissions
     */
    public function handle(Request $request, Closure $next, ...$permissions)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        $role = strtolower(trim((string) ($user->role ?? '')));

        if ($role === 'doctor') {
            return $next($request);
        }

        if (empty($permissions)) {
            return $next($request);
        }

        if ($user->hasAnyPermission($permissions)) {
            return $next($request);
        }

        return response()->json(['message' => 'Forbidden.'], 403);
    }
}
