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
        $chats = Chat::with(['members', 'members.user', 'messages', 'owner'])->get();

        return response()->json([
            'data' => $chats,
        ]);
    }

    public function CreateChat(Request $request){
        
        $chat = Chat::create([
            'title' => $request->title,
            'bio' => $request->bio,
            'owner_id' => $request->owner_id,
            'avatar' => $request->avatar
        ]);

        $chat->members()->create([
            'user_id' => $request->owner_id,
            'type' => 'member'
        ]);

        if(!empty($chat)){
            return response()->json([
                'message' => 'success'
            ]);
        }

        return response()->json([
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
                'data' => $mess,
                'message' => 'success'
            ]);
        }

        return response()->json([
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
            'data' => $messages,
        ]);
    }   

    public function deleteMessage(Request $request){
        Message::findOrFail($request->message_id)->delete();
    }
}
