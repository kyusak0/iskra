<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Video extends Model
{
    protected $fillable = [
        'title','desc','source_id','duration','cover_id','views_count','author_id','url','commentable'
    ];

    public function source(){
        return $this->belongsTo(Source::class, 'source_id');
    }

    public function cover(){
        return $this->belongsTo(Source::class, 'cover_id');
    }

    public function user(){
        return $this->belongsTo(User::class, 'author_id');
    }

    public function messages()
    {
        return $this->morphMany(Message::class, 'messageable');
    }

    public function tags()
    {
        return $this->belongsToMany(Tag::class, 'tag_video', 'video_id', 'tag_id');
    }

    public function reposts(){
        return $this->hasMany(Repost::class, 'video_id');
    }
}
