<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Models\Chat;
use App\Models\Post;
use App\Models\Video;

use App\Models\Message;
use App\Models\Repost;

class DebateController extends Controller
{
    public function getChats(){
        $chats = Chat::with(['members', 'messages', 'messages.source', 'owner'])->get();

        return response()->json([
            'success' => true,
            'data' => $chats,
        ]);
    }

    public function getChatInfo($id){
        $chat = Chat::where('id', $id)->with(['members', 'messages', 'owner'])->first();
    
    if (!$chat) {
        return response()->json([
            'success' => false,
            'message' => 'Chat not found'
        ], 404);
    }

    return response()->json([
        'success' => true,
        'data' => $chat,
    ]);

    }

    public function pinMess(Request $request) {
        $mess = Message::findOrFail($request->message_id);
        $mess->update([
            'is_pinned' => $request->is_pinned
        ]);

        return response()->json([
            'success' => true,
            'data' => $mess,
        ]);
    }
    
    public function getChatUrl($url){
        $chat = Chat::where('url', $url)->with(['members', 'messages','messages.message', 'messages.user','messages.source', 'owner'])->first();

        return response()->json([
            'success' => true,
            'data' => $chat,
        ]);
    }

    public function CreateChat(Request $request){
        
        $chat = Chat::create([
            'title' => $request->title,
            'bio' => $request->bio,
            'owner_id' => $request->owner_id,
            'avatar' => $request->avatar,
            'type' => $request->type,
            'url' => $request->url

        ]);

        $chat->members()->attach($request->owner_id);

        if(!empty($chat)){
            return response()->json([
                'success' => true,
                'message' => 'Чат создан успешно'
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'failed'
        ]);
    }

    public function CreateChatPersonal(Request $request){
        $existing_chat = Chat::where('type', 'personal')
    ->whereHas('members', function ($query) use ($request) {
        $query->where('users.id', $request->user_id); 
    })
    ->whereHas('members', function ($query) use ($request) {
        $query->where('users.id', $request->other_user_id);
    })
    ->first();

        if ($existing_chat) {
            return response()->json([
                'success' => true,
                'data' => $existing_chat
            ]);
        }

        $chat = Chat::create([
            'title' => $request->title,
            'owner_id' => $request->user_id,
            'type' => 'personal',
        ]);

        $chat->members()->attach([$request->user_id, $request->other_user_id]);

        if (!empty($chat)) {
            return response()->json([
                'success' => true,
                'message' => 'Чат создан успешно',
                'data' => $chat
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'failed'
        ]);
    }


    public function sendMessage(Request $request){

        $url = Route::current()->uri(); 
        if(str_contains($url, 'post')){
            $data = Post::findOrFail($request->post_id);
            $mess = $data->messages()->create(['content' => $request->content, 
            'author_id' => $request->author_id, 'type' => 'comment', 
            'answer_id' => $request->answer_id,
            'source_id' => $request->source_id]);
        }
        else if(str_contains($url, 'video')){
            $data = Video::findOrFail($request->video_id);
            $mess = $data->messages()->create(['content' => $request->content, 
            'author_id' => $request->author_id, 'type' => 'comment', 
            'answer_id' => $request->answer_id,
            'source_id' => $request->source_id]);
        }
        else{
            $data = Chat::findOrFail($request->chat_id);
            $mess = $data->messages()->create(['content' => $request->content, 
            'author_id' => $request->author_id, 'type' => 'chat',
            'answer_id' => $request->answer_id,
            'source_id' => $request->source_id]);
        }

        if(!empty($data)){
            
        $mess = Message::with(['user', 'message', 'source'])
        ->find($mess->id);
            return response()->json([
                'success' => true,
                'data' => $mess,
                'message' => 'success'
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'failed'
        ]);
    }

    public function commentable(Request $request){
        $url = Route::current()->uri(); 
        if(str_contains($url, 'post')){
            $data = Post::findOrFail($request->post_id);
        }
        else if(str_contains($url, 'video')){
            $data = Video::findOrFail($request->video_id);
        }
        else{
            $data = Chat::findOrFail($request->chat_id);
        }

        $data::query()->update([
            'commentable' => $request->commentable
        ]);

        return response()->json([
            'success' => true,
        ]);
    }

    public function repost(Request $request){
        $data = $request->validate([
            'post_id' => 'required|integer',
            'user_id' => 'required|exists:users,id',
            'link' => 'required|string'
        ]);

        $existing_repost = Repost::where('user_id', $request->user_id)
            ->where('link', $request->link)
            ->first();

        if(!empty($existing_repost)){
            return response()->json([
                'success' => true,
                'data' => $existing_repost,
                'message' => 'Repost already exists'
            ]);
        }

        $repost = Repost::create([
            'post_id' => $data['post_id'],
            'user_id' => $data['user_id'],
            'link' => $data['link']
        ]);

        if(!empty($repost)){
            return response()->json([
                'success' => true,
                'data' => $repost,
                'message' => 'Repost created successfully'
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'Failed to create repost'
        ], 500);
    }

    public function getMessages($id)
    {
        $url = Route::current()->uri(); 
        if(str_contains($url, 'post')){
            $messages = Message::where('messageable_id', $id)
                            ->where('messageable_type', 'App\Models\Post')
                            ->with(['user', 'message', 'message.user','source'])
                            ->get();
        } else if(str_contains($url, 'chat')){
            $messages = Message::where('messageable_id', $id)
                            ->where('messageable_type', 'App\Models\Chat')
                            ->with(['user', 'message', 'message.user','source'])
                            ->get();
        }else if(str_contains($url, 'video')){
            $messages = Message::where('messageable_id', $id)
                            ->where('messageable_type', 'App\Models\Video')
                            ->with(['user', 'message', 'message.user','source'])
                            ->get();
        }

        return response()->json([
            'success' => true,
            'data' => $messages,
        ]);
    }   

    public function deleteMessage(Request $request){
        Message::findOrFail($request->message_id)->delete();
        return response()->json([
            'success' => true,
        ]);
    }

    public function subscribe(Request $request){
        $chat = Chat::findOrFail($request->chat_id);

        $chat->members()->attach($request->user_id);

        return response()->json([
            'success' => true,
        ]);
    }
}
