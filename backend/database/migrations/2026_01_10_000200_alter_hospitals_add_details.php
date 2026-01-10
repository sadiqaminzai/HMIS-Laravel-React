<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('hospitals', function (Blueprint $table) {
            $table->string('code', 64)->nullable()->unique()->after('slug');
            $table->string('license')->nullable()->after('address');
            $table->date('license_issue_date')->nullable()->after('license');
            $table->date('license_expiry_date')->nullable()->after('license_issue_date');
            $table->enum('status', ['active', 'suspended'])->default('active')->after('subscription_status');
            $table->string('brand_color', 32)->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('hospitals', function (Blueprint $table) {
            $table->dropColumn([
                'code',
                'license',
                'license_issue_date',
                'license_expiry_date',
                'status',
                'brand_color',
            ]);
        });
    }
};
