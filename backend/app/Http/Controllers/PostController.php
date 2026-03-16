<?php

namespace App\Http\Controllers;

use App\Models\Post;
use App\Models\Video;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PostController extends Controller
{
    public function createPost(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'nullable|string|max:255',
            'desc' => 'nullable|string',
            'source_id' => 'nullable|exists:sources,id',
            'type' => 'required|string|max:50',
            'url' => 'required|string|max:255|unique:posts,url',
            'tags' => 'nullable|array',
            'tags.*' => 'integer|exists:tags,id',
        ]);

        $post = Post::create([
            'title' => $validated['title'] ?? null,
            'desc' => $validated['desc'] ?? null,
            'source_id' => $validated['source_id'] ?? null,
            'author_id' => $request->user()->id,
            'type' => $validated['type'],
            'url' => $validated['url'],
        ]);

        if (!empty($validated['tags'])) {
            $post->tags()->sync($validated['tags']);
        }

        $post->load(['user', 'source', 'tags']);

        return response()->json([
            'success' => true,
            'data' => $post,
        ]);
    }

    public function getPosts(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => Post::query()->with(['user', 'source', 'messages', 'tags'])->paginate(3),
        ]);
    }

    public function getPostInfo($url): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => Post::with(['user', 'source', 'messages', 'messages.source', 'messages.user', 'messages.message', 'tags', 'reposts.user'])
                ->where('url', $url)
                ->first(),
        ]);
    }

    public function createVideo(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'title' => 'nullable|string|max:255',
            'desc' => 'nullable|string',
            'source_id' => 'nullable|exists:sources,id',
            'cover_id' => 'nullable|exists:sources,id',
            'duration' => 'required',
            'url' => 'required|string|max:255|unique:videos,url',
            'tags' => 'nullable|array',
            'tags.*' => 'integer|exists:tags,id',
        ]);

        $video = Video::create([
            'title' => $validated['title'] ?? null,
            'desc' => $validated['desc'] ?? null,
            'source_id' => $validated['source_id'] ?? null,
            'cover_id' => $validated['cover_id'] ?? null,
            'author_id' => $request->user()->id,
            'duration' => $validated['duration'],
            'url' => $validated['url'],
        ]);

        if (!empty($validated['tags'])) {
            $video->tags()->sync($validated['tags']);
        }

        $video->load(['tags', 'source', 'cover', 'user']);

        return response()->json([
            'success' => true,
            'data' => $video,
        ]);
    }

    public function getVideos(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => Video::query()
                ->with(['source.user', 'source', 'cover', 'messages', 'messages.message', 'tags', 'user'])
                ->orderBy('views_count', 'desc')
                ->paginate(3),
        ]);
    }

    public function getVideoInfo($id): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => Video::with(['user', 'source', 'cover', 'messages', 'messages.user', 'messages.message', 'tags', 'reposts.user'])
                ->where('url', $id)
                ->first(),
        ]);
    }

    public function view($id): JsonResponse
    {
        $video = Video::findOrFail($id);
        $video->increment('views_count');

        return response()->json([
            'success' => true,
        ]);
    }
}
