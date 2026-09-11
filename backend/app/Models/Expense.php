<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Expense extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'hospital_id',
        'expense_category_id',
        'sequence_id',
        'title',
        'amount',
        'expense_date',
        'payment_method',
        'reference',
        'document_path',
        'notes',
        'status',
        'created_by',
        'updated_by',
        'approved_by',
        'approved_at',
        'rejected_by',
        'rejected_at',
    ];

    protected $casts = [
        // 'date:Y-m-d', not 'date'. A plain date cast serialises through UTC, so
        // midnight in Kabul (+04:30) leaves as "...T19:30:00Z" and a client
        // reading the first ten characters gets the PREVIOUS day.
        'expense_date' => 'date:Y-m-d',
        'amount' => 'decimal:2',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
    ];

    protected $appends = ['document_url'];

    public function category()
    {
        return $this->belongsTo(ExpenseCategory::class, 'expense_category_id');
    }

    /**
     * An ABSOLUTE url for the attached receipt.
     *
     * `Storage::url()` resolves against the DEFAULT disk, which is `local` --
     * it returned a root-relative "/storage/expenses/x.png". The SPA is served
     * from its own origin (the Vite dev server, or the site root in
     * production), so the browser asked that origin for the file and got a 404:
     * the receipt lives behind the API's origin, not the app's. Naming the
     * public disk uses its configured absolute `url`, which points at the
     * backend.
     *
     * Built with `url()` rather than the disk's configured url, because the
     * disk url is pinned to APP_URL -- currently "http://localhost:8000", while
     * Apache actually serves this app from a sub-directory. `url()` resolves
     * against the ROOT OF THE REQUEST THAT ASKED, so the link is right whether
     * the API is reached on a port, in a sub-folder, or on a real domain.
     *
     * Requires `php artisan storage:link` on the server; without the symlink
     * the url is correct but the file is not served.
     */
    public function getDocumentUrlAttribute()
    {
        if (!$this->document_path) {
            return null;
        }

        // Stored paths use the OS separator on Windows ("expenses\x.png"); a
        // backslash in a URL is not a path separator, so it is normalised here.
        return url('storage/' . str_replace('\\', '/', $this->document_path));
    }
}
