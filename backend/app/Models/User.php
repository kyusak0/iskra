<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens; 

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'avatar',
        'role',
        'is_blocked'
    ];

    public function sources(){
        return $this->hasMany(Source::class, 'author_id');
    }

    public function posts(){
        return $this->hasMany(Post::class, 'author_id');
    }

    public function videos(){
        return $this->hasMany(Video::class, 'author_id');
    }

    public function messages(){
        return $this->hasMany(Message::class, 'author_id');
    }

    public function owner(){
        return $this->hasMany(Chat::class, 'owner_id');
    }

    public function chats(){
        return $this->belongsToMany(Chat::class, 'chat_user', 'user_id', 'chat_id');
    }

    public function subs(){
        return $this->belongsToMany(User::class, 'subs', 'creator_id', 'user_id');
    }

    public function reposts(){
        return $this->hasMany(Repost::class);
    }
    public function sentFriendRequests()
    {
        return $this->hasMany(FriendRequest::class, 'sender_id');
    }

    public function receivedFriendRequests()
    {
        return $this->hasMany(FriendRequest::class, 'receiver_id');
    }

    public function blockedUsers()
    {
        return $this->belongsToMany(User::class, 'user_blocks', 'blocker_id', 'blocked_id');
    }

    public function blockedByUsers()
    {
        return $this->belongsToMany(User::class, 'user_blocks', 'blocked_id', 'blocker_id');
    }

    public function readMessages()
    {
        return $this->belongsToMany(Message::class, 'message_reads', 'user_id', 'message_id')
            ->withPivot('read_at')
            ->withTimestamps();
    }


    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }
}
