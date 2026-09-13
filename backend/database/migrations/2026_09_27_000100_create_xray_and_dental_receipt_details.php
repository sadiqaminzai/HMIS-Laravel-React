<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * One X-Ray or Dental receipt, several studies or services.
 *
 * A patient sent for a chest film and an ankle film was two receipts, two
 * receipt numbers and two trips to the counter, because a receipt could name
 * only one study. The lines move into a details table; the receipt keeps what
 * belongs to the whole bill -- patient, date, gross, discount, net, payment --
 * so every report, the ledger and Payment Collection keep reading the columns
 * they already read.
 *
 * EXISTING DATA. Every receipt already on file becomes a receipt with exactly
 * one line, copied from its own header: the study or service it names, the
 * catalogue entry it points at, and its fee. The header row is not touched --
 * not its fee, not its discount, not its payment -- so a report run before and
 * after this migration returns the same totals. The copy is skipped for any
 * receipt that already has lines, so running it twice cannot double a bill.
 *
 * Deleting a receipt deletes its lines (ON DELETE CASCADE on a hard delete, and
 * explicitly in the controller for the soft delete the desks use). Retiring a
 * catalogue entry does NOT delete a line: the line keeps its copied name and
 * price, so money already taken can never lose its label.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('xray_receipts') && !Schema::hasTable('xray_receipt_details')) {
            Schema::create('xray_receipt_details', function (Blueprint $table) {
                $table->id();
                $table->foreignId('xray_receipt_id')->constrained('xray_receipts')->cascadeOnDelete();
                $table->foreignId('xray_type_id')->nullable()->constrained('xray_types')->nullOnDelete();
                // Copied at billing time, so renaming or repricing a study later
                // cannot rewrite a receipt already printed.
                $table->string('study_name', 191);
                $table->decimal('fee', 12, 2)->default(0);
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();

                $table->index(['xray_receipt_id', 'sort_order']);
            });
        }

        if (Schema::hasTable('dental_receipts') && !Schema::hasTable('dental_receipt_details')) {
            Schema::create('dental_receipt_details', function (Blueprint $table) {
                $table->id();
                $table->foreignId('dental_receipt_id')->constrained('dental_receipts')->cascadeOnDelete();
                $table->foreignId('dental_service_id')->nullable()->constrained('dental_services')->nullOnDelete();
                $table->string('service_name', 191);
                $table->decimal('fee', 12, 2)->default(0);
                $table->unsignedInteger('sort_order')->default(0);
                $table->timestamps();

                $table->index(['dental_receipt_id', 'sort_order']);
            });
        }

        $this->backfill('xray_receipts', 'xray_receipt_details', 'xray_receipt_id', 'xray_type_id', 'xray_types', 'study_name');
        $this->backfill('dental_receipts', 'dental_receipt_details', 'dental_receipt_id', 'dental_service_id', 'dental_services', 'service_name');
    }

    /**
     * One line per receipt that has none, read straight off its header.
     *
     * Soft-deleted receipts are included: they still hold a fee, and a line is
     * what a restored receipt would need. The catalogue id is only copied when
     * that row still exists -- a hard-deleted entry would otherwise fail the
     * foreign key and abort the whole migration.
     */
    private function backfill(string $header, string $details, string $fk, string $catalogueFk, string $catalogue, string $nameColumn): void
    {
        if (!Schema::hasTable($header) || !Schema::hasTable($details)) {
            return;
        }

        DB::statement("
            INSERT INTO {$details} ({$fk}, {$catalogueFk}, {$nameColumn}, fee, sort_order, created_at, updated_at)
            SELECT r.id,
                   c.id,
                   COALESCE(NULLIF(TRIM(r.{$nameColumn}), ''), c.name, '-'),
                   COALESCE(r.fee, 0),
                   0,
                   r.created_at,
                   r.updated_at
            FROM {$header} r
            LEFT JOIN {$catalogue} c ON c.id = r.{$catalogueFk}
            WHERE NOT EXISTS (SELECT 1 FROM {$details} d WHERE d.{$fk} = r.id)
        ");
    }

    /**
     * Drops the lines only. The headers were never altered, so they already
     * hold everything they held before this migration ran.
     */
    public function down(): void
    {
        Schema::dropIfExists('dental_receipt_details');
        Schema::dropIfExists('xray_receipt_details');
    }
};
