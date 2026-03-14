<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('prescription_item_group_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('prescription_id')->constrained('prescriptions')->cascadeOnDelete();
            $table->foreignId('prescription_item_id')->constrained('prescription_items')->cascadeOnDelete();
            $table->string('group_key', 64);
            $table->string('group_label')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->string('created_by')->nullable();
            $table->timestamps();

            $table->unique('prescription_item_id');
            $table->index(['prescription_id', 'group_key', 'sort_order'], 'rx_item_group_lookup_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('prescription_item_group_links');
    }
};
