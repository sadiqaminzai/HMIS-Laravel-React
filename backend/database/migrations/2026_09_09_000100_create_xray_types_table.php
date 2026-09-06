<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * A catalogue of X-Ray studies, so a receipt picks a study instead of typing
 * one.
 *
 * xray_receipts.study_name has always been free text, which means the same
 * study is spelled three ways across a month of receipts, its price is retyped
 * every time, and nothing can report on "how many chest X-Rays". This mirrors
 * ultrasound_types exactly -- same columns, same soft delete, same per-hospital
 * scoping -- so the two radiology desks behave identically.
 *
 * study_name stays on the receipt as the printed label. The new xray_type_id
 * is nullable: historical receipts have no type, and a type that is later
 * deleted must not take its receipts with it.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('xray_types')) {
            Schema::create('xray_types', function (Blueprint $table) {
                $table->id();
                $table->foreignId('hospital_id')->constrained('hospitals')->cascadeOnDelete();
                $table->string('name');
                $table->string('code')->nullable();
                $table->text('description')->nullable();
                $table->decimal('price', 12, 2)->default(0);
                $table->integer('sort_order')->default(0);
                $table->boolean('is_active')->default(true);
                $table->string('created_by')->nullable();
                $table->string('updated_by')->nullable();
                $table->timestamps();
                $table->softDeletes();

                // The list is always drawn per hospital, active first, in the
                // order the hospital chose.
                $table->index(['hospital_id', 'is_active', 'sort_order'], 'xray_types_listing_index');
            });
        }

        if (Schema::hasTable('xray_receipts') && !Schema::hasColumn('xray_receipts', 'xray_type_id')) {
            Schema::table('xray_receipts', function (Blueprint $table) {
                // nullOnDelete, not cascade: removing a study from the
                // catalogue must never delete the money already taken for it.
                $table->foreignId('xray_type_id')
                    ->nullable()
                    ->after('doctor_id')
                    ->constrained('xray_types')
                    ->nullOnDelete();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('xray_receipts') && Schema::hasColumn('xray_receipts', 'xray_type_id')) {
            Schema::table('xray_receipts', function (Blueprint $table) {
                $table->dropForeign(['xray_type_id']);
                $table->dropColumn('xray_type_id');
            });
        }

        Schema::dropIfExists('xray_types');
    }
};
