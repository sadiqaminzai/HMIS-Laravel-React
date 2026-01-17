<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Spatie\Permission\PermissionRegistrar;

class SetPermissionsTeam
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if ($user && $user->role !== 'super_admin') {
            app(PermissionRegistrar::class)->setPermissionsTeamId($user->hospital_id);
        } else {
            app(PermissionRegistrar::class)->setPermissionsTeamId(null);
        }

        return $next($request);
    }
}
