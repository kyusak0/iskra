<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Models\Chat;
use App\Models\Post;
use App\Models\Debate;
use App\Models\Message;

class DebateController extends Controller
{
    public function getChats(){
        $chats = Chat::with(['members', 'members.user', 'messages', 'messages.source', 'owner'])->get();

        return response()->json([
            'data' => $chats,
        ]);
    }

    public function getChatInfo($id){
        $chat = Chat::with(['members', 'members.user', 'messages', 'owner'])->findOrFail($id);

        return response()->json([
            'data' => $chat,
        ]);
    }

    public function CreateChat(Request $request){
        
        $chat = Chat::create([
            'title' => $request->title,
            'bio' => $request->bio,
            'owner_id' => $request->owner_id,
            'avatar' => $request->avatar,
            'type' => $request->type
        ]);

        $chat->members()->create([
            'user_id' => $request->owner_id,
            'type' => 'member'
        ]);

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


    public function sendMessage(Request $request){

        $url = Route::current()->uri(); 
        if(str_contains($url, 'post')){
            $data = Post::find($request->post_id);
            $mess = $data->messages()->create(['content' => $request->content, 
            'author_id' => $request->author_id, 'type' => 'comment', 
            'answer_id' => $request->answer_id,
            'source_id' => $request->source_id]);
        }else{
            $data = Chat::find($request->chat_id);
            $mess = $data->messages()->create(['content' => $request->content, 
            'author_id' => $request->author_id, 'type' => 'chat',
            'answer_id' => $request->answer_id,
            'source_id' => $request->source_id]);
        }

        
        
        if(!empty($data)){
            
        $mess = Message::with(['user', 'message'])
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
        $chat = Chat::find($request->chat_id);
        $chat->members()->create([
            'user_id' => $request->user_id,
            'type' => 'member'
        ]);

        return response()->json([
            'success' => true,
        ]);
    }
}
