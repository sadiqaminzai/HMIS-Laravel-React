<?php

use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\PermissionRegistrar;

/**
 * Throw away Spatie's cached permission list.
 *
 * The permission migrations of this release insert rows straight into the
 * permissions and role_has_permissions tables. Spatie keeps its own copy of the
 * permission list for 24 hours and does not notice rows written behind its
 * back -- so after deploy the new rights (Take / Return Payment, Set Fee, Edit
 * Receipt, the report rights) were shown as ticked on the Roles screen, were
 * listed for the user, and were still refused by the server as "Forbidden".
 *
 * Running last, this makes the next request rebuild the list from the tables.
 * User::withFreshPermissionCache() also recovers on its own, but a deploy should
 * not leave the first refused request to do it.
 *
 * Touches the cache only. No table, row or grant changes.
 */
return new class extends Migration
{
    public function up(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
