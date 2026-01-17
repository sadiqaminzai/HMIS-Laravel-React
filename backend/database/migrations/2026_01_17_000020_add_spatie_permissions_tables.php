<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Permissions table: add guard_name
        Schema::table('permissions', function (Blueprint $table) {
            if (!Schema::hasColumn('permissions', 'guard_name')) {
                $table->string('guard_name')->default('web')->after('name');
            }
        });

        // Roles table: add guard_name
        Schema::table('roles', function (Blueprint $table) {
            if (!Schema::hasColumn('roles', 'guard_name')) {
                $table->string('guard_name')->default('web')->after('name');
            }
        });

        if (!Schema::hasTable('role_has_permissions')) {
            Schema::create('role_has_permissions', function (Blueprint $table) {
                $table->unsignedBigInteger('permission_id');
                $table->unsignedBigInteger('role_id');
                $table->unsignedBigInteger('hospital_id')->nullable();

                $table->index(['role_id'], 'role_has_permissions_role_id_index');
                $table->index(['permission_id'], 'role_has_permissions_permission_id_index');
                $table->index(['hospital_id'], 'role_has_permissions_hospital_id_index');

                $table->primary(['permission_id', 'role_id', 'hospital_id'], 'role_has_permissions_permission_role_hospital_primary');

                $table->foreign('permission_id')->references('id')->on('permissions')->cascadeOnDelete();
                $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
                // hospital_id is used for team scoping; keep without FK to avoid migration issues.
            });
        }

        if (!Schema::hasTable('model_has_roles')) {
            Schema::create('model_has_roles', function (Blueprint $table) {
                $table->unsignedBigInteger('role_id');
                $table->string('model_type');
                $table->unsignedBigInteger('model_id');
                $table->unsignedBigInteger('hospital_id')->nullable();

                $table->index(['model_id', 'model_type'], 'model_has_roles_model_id_model_type_index');
                $table->index(['role_id'], 'model_has_roles_role_id_index');
                $table->index(['hospital_id'], 'model_has_roles_hospital_id_index');

                $table->primary(['role_id', 'model_id', 'model_type', 'hospital_id'], 'model_has_roles_role_model_hospital_primary');

                $table->foreign('role_id')->references('id')->on('roles')->cascadeOnDelete();
                // hospital_id is used for team scoping; keep without FK to avoid migration issues.
            });
        }

        if (!Schema::hasTable('model_has_permissions')) {
            Schema::create('model_has_permissions', function (Blueprint $table) {
                $table->unsignedBigInteger('permission_id');
                $table->string('model_type');
                $table->unsignedBigInteger('model_id');
                $table->unsignedBigInteger('hospital_id')->nullable();

                $table->index(['model_id', 'model_type'], 'model_has_permissions_model_id_model_type_index');
                $table->index(['permission_id'], 'model_has_permissions_permission_id_index');
                $table->index(['hospital_id'], 'model_has_permissions_hospital_id_index');

                $table->primary(['permission_id', 'model_id', 'model_type', 'hospital_id'], 'model_has_permissions_perm_model_hospital_primary');

                $table->foreign('permission_id')->references('id')->on('permissions')->cascadeOnDelete();
                // hospital_id is used for team scoping; keep without FK to avoid migration issues.
            });
        }

        // Backfill guard_name defaults
        DB::table('permissions')->whereNull('guard_name')->update(['guard_name' => 'web']);
        DB::table('roles')->whereNull('guard_name')->update(['guard_name' => 'web']);

        // Migrate existing role-permission links
        if (Schema::hasTable('permission_role') && Schema::hasTable('role_has_permissions')) {
            $links = DB::table('permission_role')
                ->join('roles', 'roles.id', '=', 'permission_role.role_id')
                ->select('permission_role.permission_id', 'permission_role.role_id', 'roles.hospital_id')
                ->get();

            foreach ($links as $link) {
                DB::table('role_has_permissions')->insertOrIgnore([
                    'permission_id' => $link->permission_id,
                    'role_id' => $link->role_id,
                    'hospital_id' => $link->hospital_id,
                ]);
            }
        }

        // Migrate user role assignments
        if (Schema::hasTable('users') && Schema::hasTable('model_has_roles')) {
            DB::table('users')
                ->whereNotNull('role_id')
                ->select('id', 'role_id', 'hospital_id')
                ->orderBy('id')
                ->chunkById(200, function ($users) {
                    foreach ($users as $user) {
                        DB::table('model_has_roles')->insertOrIgnore([
                            'role_id' => $user->role_id,
                            'model_type' => 'App\\Models\\User',
                            'model_id' => $user->id,
                            'hospital_id' => $user->hospital_id,
                        ]);
                    }
                });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('model_has_permissions')) {
            Schema::drop('model_has_permissions');
        }
        if (Schema::hasTable('model_has_roles')) {
            Schema::drop('model_has_roles');
        }
        if (Schema::hasTable('role_has_permissions')) {
            Schema::drop('role_has_permissions');
        }

        Schema::table('permissions', function (Blueprint $table) {
            if (Schema::hasColumn('permissions', 'guard_name')) {
                $table->dropColumn('guard_name');
            }
        });

        Schema::table('roles', function (Blueprint $table) {
            if (Schema::hasColumn('roles', 'guard_name')) {
                $table->dropColumn('guard_name');
            }
        });
    }
};
