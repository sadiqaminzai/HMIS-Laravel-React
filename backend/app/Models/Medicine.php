<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use App\Models\Traits\Sequenceable;

class Medicine extends Model
{
    use HasFactory, SoftDeletes, Sequenceable;

    protected static $sequenceModule = 'medicine';
    protected static $sequenceColumn = 'serial_no';

    protected $fillable = [
        'hospital_id',
        'manufacturer_id',
        'medicine_type_id',
        'brand_name',
        'generic_name',
        'strength',
        'pack_size',
        'pack_label',
        'pieces_per_strip',
        'strips_per_pack',
        'strip_price',
        'strip_label',
        'sellable_units',
        'default_sale_unit',
        'barcode',
        'barcode_type',
        'created_by',
        'updated_by',
        'stock',
        'cost_price',
        'sale_price',
        'pack_price',
        'status',
    ];

    protected $casts = [
        'stock' => 'integer',
        'pack_size' => 'integer',
        'pack_price' => 'decimal:2',
        'strip_price' => 'decimal:2',
        'pieces_per_strip' => 'integer',
        'strips_per_pack' => 'integer',
        'sellable_units' => 'array',
        'cost_price' => 'decimal:2',
        'sale_price' => 'decimal:2',
    ];

    /**
     * How many base pieces one unit of $saleUnit contains.
     * The single source of truth for every pack/strip conversion.
     */
    public function piecesPerUnit(string $saleUnit): int
    {
        return match ($saleUnit) {
            'pack' => max(1, (int) $this->pack_size),
            'strip' => max(1, (int) $this->pieces_per_strip),
            default => 1,
        };
    }

    public function hospital()
    {
        return $this->belongsTo(Hospital::class);
    }

    public function manufacturer()
    {
        return $this->belongsTo(Manufacturer::class);
    }

    public function medicineType()
    {
        return $this->belongsTo(MedicineType::class);
    }

    public function stocks()
    {
        return $this->hasMany(Stock::class);
    }

    public function transactionDetails()
    {
        return $this->hasMany(TransactionDetail::class);
    }
}
