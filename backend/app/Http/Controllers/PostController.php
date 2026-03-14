<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Post;
use App\Models\Video;

class PostController extends Controller
{
    public function createPost(Request $request){
        $data = $request->validate([
            'title' => 'nullable|string',
            'desc' => 'nullable|string',
            'source_id' => 'nullable|exists:sources,id',
            'author_id' => 'required|exists:users,id',
            'type' => 'required',
            'url' => 'required|string'
        ], [
            'title.string' => 'Заголовок должен быть текстовой строкой',
            
            'desc.string' => 'Описание должно быть текстовой строкой',
            
            'source_id.exists' => 'Указанный источник не найден в базе данных',
            
            'author_id.required' => 'Необходимо указать автора',
            'author_id.exists' => 'Указанный автор не зарегистрирован в системе',
            
            'type.required' => 'Необходимо указать тип записи'
        ]);

        $post = Post::create($data);

        $post->tags()->attach($request->tags);

        if(!empty($post)){
            return response()->json([
                'success' => true,
                'data' => $post,
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'failed',
        ]);
    }

    public function getPosts(){
        $posts = Post::query()->with(['user', 'source', 'messages', 'tags'])->paginate(3);

        return response()->json([
            'success' => true,
            'data' => $posts,
        ]);
    }

    public function getPostInfo($url){
        $post = Post::with(['user', 'source', 'messages', 'messages.source', 'messages.user', 'messages.message', 'tags'])->where('url', $url)->first();

        return response()->json([
            'success' => true,
            'data' => $post,
        ]);
    }

    public function createVideo(Request $request) {
        $data = $request->validate([
            'title' => 'nullable|string',
            'desc' => 'nullable|string',
            'source_id' => 'nullable|exists:sources,id',
            'cover_id' => 'nullable|exists:sources,id',
            'author_id' => 'nullable|exists:users,id',
            'duration' => 'required',
            'url' => 'required|string'
        ]);

        $video = Video::create($data);

        $video->tags()->attach($request->tags);

        if(!empty($video)){
            $video->load('tags');
            return response()->json([
                'success' => true,
                'data' => $video,
            ]);
        }

        return response()->json([
            'success' => false,
            'message' => 'failed',
        ]);
    }

    public function getVideos(){
        $videos = Video::query()
    ->with(['source.user', 'source', 'cover', 'messages', 'messages.message', 'tags', 'user'])
    ->orderBy('views_count', 'desc')
    ->paginate(3);

        return response()->json([
            'success' => true,
            'data' => $videos,
        ]);
    }

    public function getVideoInfo($id){
        $video = Video::with(['user', 'source', 'cover', 'messages', 'messages.user', 'messages.message', 'tags'])->where('url', $id)->first();
    
        return response()->json([
            'success' => true,
            'data' => $video,
        ]);
    }

    public function view($id){
        $video = Video::findOrFail($id);
        $video->increment('views_count');

         return response()->json([
            'success' => true,
        ]);
    }
}
