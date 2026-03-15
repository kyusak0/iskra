<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Repost extends Model
{
    protected $fillable = ['post_id', 'user_id', 'link'];

    public function posts(){
        return $this->belongsTo(Post::class, 'post_id');
    }

    public function videos(){
        return $this->belongsTo(Video::class, 'post_id');
    }

    public function user(){
        return $this->belongsTo(User::class, "user_id");
    }
}
