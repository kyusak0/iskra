<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    protected $fillable = [
        'content','source_id','author_id','answer_id','type','messageable'
    ];

    public function source(){
        return $this->belongsTo(Source::class, 'source_id');
    }

    public function user(){
        return $this->belongsTo(User::class, 'author_id');
    }

    public function message(){
        return $this->belongsTo(Message::class, 'answer_id');
    }

    public function answer(){
        return $this->hasMany(Message::class, 'answer_id');
    }

    public function messageable()
    {
        return $this->morphTo();
    }
}
