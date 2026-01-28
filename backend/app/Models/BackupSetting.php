<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\Sequenceable;

class BackupSetting extends Model
{
    use HasFactory, Sequenceable;

    protected static $sequenceModule = 'backup_setting';
    protected static $sequenceColumn = 'serial_no';

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
