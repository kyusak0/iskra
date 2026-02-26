<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Partaker extends Model
{
    protected $fillable = [
        'type', 'partakerable', 'user_id'
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function partakerable()
    {
        return $this->morphTo();
    }
}
