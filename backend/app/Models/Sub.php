<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Sub extends Model
{
    protected $fillable =['creator_id','user_id'];

    public function creator(){
        return $this->belongsTo(User::class);
    }

    public function subs(){
        return $this->belongsTo(User::class);
    }
}
