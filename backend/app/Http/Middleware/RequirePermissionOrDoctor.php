<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class RequirePermissionOrDoctor
{
    /**
     * Allows access when either:
        * - user is a doctor (users.is_doctor = 1 or role=doctor), OR
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

            if ($user && ($user->role === 'doctor' || $user->is_doctor)) {
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
