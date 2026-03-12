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
            'type' => 'required'
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
        $posts = Post::with(['user', 'source', 'messages', 'tags'])->get();

        return response()->json([
            'success' => true,
            'data' => $posts,
        ]);
    }

    public function getPostInfo($id){
        $post = Post::with(['user', 'source', 'messages', 'messages.source', 'messages.user', 'messages.message', 'tags'])->findOrFail($id);

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
            'duration' => 'required'
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
    ->with(['source.user', 'source', 'cover', 'messages', 'tags'])
    ->orderBy('views_count', 'desc')
    ->paginate(3);

        return response()->json([
            'success' => true,
            'data' => $videos,
        ]);
    }

    public function getVideoInfo($id){
        $video = Video::with(['source.user', 'source', 'cover', 'messages', 'tags'])->findOrFail($id);
    
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
