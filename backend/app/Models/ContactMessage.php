<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\Traits\Sequenceable;

class ContactMessage extends Model
{
    use HasFactory, Sequenceable;

    protected static $sequenceModule = 'contact_message';
    protected static $sequenceColumn = 'serial_no';

    protected $fillable = [
        'name',
        'email',
        'phone',
        'subject',
        'message',
        'status',
        'hospital_id',
    ];
}
