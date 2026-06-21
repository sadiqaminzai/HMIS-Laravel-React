<?php

namespace App\Models\General;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use App\Models\User;

class Designation extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'created_by',
        'updated_by',
        'deleted_by',
        'is_active',
        'is_delete',
    ];
    public function user()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
    public function Updated_By()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
    public function Deleted_By()
    {
        return $this->belongsTo(User::class, 'deleted_by');
    }

}
