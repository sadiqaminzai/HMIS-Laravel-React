<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('role_has_permissions')) {
            DB::statement('ALTER TABLE role_has_permissions MODIFY hospital_id BIGINT UNSIGNED NULL');
        }

        if (Schema::hasTable('model_has_roles')) {
            DB::statement('ALTER TABLE model_has_roles MODIFY hospital_id BIGINT UNSIGNED NULL');
        }

        if (Schema::hasTable('model_has_permissions')) {
            DB::statement('ALTER TABLE model_has_permissions MODIFY hospital_id BIGINT UNSIGNED NULL');
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('role_has_permissions')) {
            DB::statement('ALTER TABLE role_has_permissions MODIFY hospital_id BIGINT UNSIGNED NOT NULL');
        }

        if (Schema::hasTable('model_has_roles')) {
            DB::statement('ALTER TABLE model_has_roles MODIFY hospital_id BIGINT UNSIGNED NOT NULL');
        }

        if (Schema::hasTable('model_has_permissions')) {
            DB::statement('ALTER TABLE model_has_permissions MODIFY hospital_id BIGINT UNSIGNED NOT NULL');
        }
    }
};
