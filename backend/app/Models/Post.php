<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Post extends Model
{
    protected $fillable = [
        'title','desc','source_id','author_id','type'
    ];

    public function source(){
        return $this->belongsTo(Source::class, 'source_id');
    }

    public function user(){
        return $this->belongsTo(User::class, 'author_id');
    }

    public function messages()
    {
        return $this->morphMany(Message::class, 'messageable');
    }

    public function subs()
    {
        return $this->morphMany(Partaker::class, 'partakerable');
    }

    public function tags()
    {
        return $this->belongsToMany(Tag::class, 'tag_post', 'post_id', 'tag_id');
    }
}
