<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class BackupSetting extends Model
{
    use HasFactory;

    protected $fillable = [
        'hospital_id',
        'enabled',
        'time',
        'retention',
    ];

    protected $casts = [
        'hospital_id' => 'integer',
        'enabled' => 'boolean',
        'retention' => 'integer',
    ];
}
