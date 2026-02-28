<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Chat extends Model
{
    protected $fillable = [
        'title','bio','owner_id','avatar','type'
    ];

    public function messages()
    {
        return $this->morphMany(Message::class, 'messageable');
    }

    public function members()
    {
        return $this->morphMany(Partaker::class, 'partakerable');
    }

    public function owner(){
        return $this->belongsTo(User::class, 'owner_id');
    }
}
