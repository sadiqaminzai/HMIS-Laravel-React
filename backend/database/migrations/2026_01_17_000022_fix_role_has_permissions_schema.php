<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            return;
        }

        if (!Schema::hasTable('role_has_permissions')) {
            return;
        }

        // Drop PK that includes hospital_id if present
        DB::statement('ALTER TABLE role_has_permissions DROP PRIMARY KEY');

        // Drop hospital_id column if exists
        $columns = collect(DB::select('SHOW COLUMNS FROM role_has_permissions'))->pluck('Field')->all();
        if (in_array('hospital_id', $columns, true)) {
            DB::statement('ALTER TABLE role_has_permissions DROP COLUMN hospital_id');
        }

        // Re-add primary key on permission_id + role_id
        DB::statement('ALTER TABLE role_has_permissions ADD PRIMARY KEY (permission_id, role_id)');
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if (! in_array($driver, ['mysql', 'mariadb'], true)) {
            return;
        }

        if (!Schema::hasTable('role_has_permissions')) {
            return;
        }

        // Drop PK and add hospital_id back (nullable) then set composite PK
        DB::statement('ALTER TABLE role_has_permissions DROP PRIMARY KEY');
        $columns = collect(DB::select('SHOW COLUMNS FROM role_has_permissions'))->pluck('Field')->all();
        if (!in_array('hospital_id', $columns, true)) {
            DB::statement('ALTER TABLE role_has_permissions ADD hospital_id BIGINT UNSIGNED NULL');
        }
        DB::statement('ALTER TABLE role_has_permissions ADD PRIMARY KEY (permission_id, role_id, hospital_id)');
    }
};
