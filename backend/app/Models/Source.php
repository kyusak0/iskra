<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Source extends Model
{
    protected $fillable = [
        'name','type','size','author_id'
    ];

    public function user(){
        return $this->belongsTo(User::class, 'author_id');
    }

    public function messages(){
        return $this->hasMany(Message::class);
    }
}
