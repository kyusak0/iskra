<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Post;

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

        if(!empty($post)){
            return response()->json([
                'message' => 'success',
                'data' => $post,
            ]);
        }

        return response()->json([
            'message' => 'failed',
        ]);
    }

    public function getPosts(){
        $posts = Post::with(['user', 'source', 'messages'])->get();

        return response()->json([
            'data' => $posts,
        ]);
    }
}
