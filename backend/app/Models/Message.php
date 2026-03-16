<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Message extends Model
{
    protected $fillable = [
        'content', 'source_id', 'author_id', 'answer_id', 'type', 'messageable', 'is_pinned'
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


    public function readers()
    {
        return $this->belongsToMany(User::class, 'message_reads', 'message_id', 'user_id')
            ->withPivot('read_at')
            ->withTimestamps();
    }

    public function messageReads()
    {
        return $this->hasMany(MessageRead::class);
    }

    public function messageable()
    {
        return $this->morphTo();
    }
}
