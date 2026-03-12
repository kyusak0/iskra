<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Tag extends Model
{
    protected $fillable = [
        'name'
    ];

    public function videos()
    {
        return $this->belongsToMany(Video::class, 'tag_video', 'video_id', 'tag_id');
    }

    public function posts()
    {
        return $this->belongsToMany(Post::class, 'tag_post', 'post_id', 'tag_id');
    }
}
