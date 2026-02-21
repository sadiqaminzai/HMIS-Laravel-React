<?php

namespace App\Http\Controllers;

abstract class Controller
{
    protected function ensureAnyPermission($user, array $permissions, string $message = 'Forbidden'): void
    {
        if (!$user) {
            abort(403, $message);
        }

        $normalized = array_values(array_filter(array_map(
            static fn ($permission) => trim((string) $permission),
            $permissions
        )));

        if (empty($normalized)) {
            return;
        }

        if (method_exists($user, 'hasAnyPermission') && $user->hasAnyPermission($normalized)) {
            return;
        }

        $permissionNames = method_exists($user, 'permissionNames') ? $user->permissionNames() : [];

        if (!empty(array_intersect($normalized, $permissionNames))) {
            return;
        }

        abort(403, $message);
    }
}
