<?php

namespace App\Http\Controllers;

use App\Models\Report;
use App\Models\Tag;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class InfoController extends Controller
{
    public function createTag(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:tags,name',
        ]);

        $tag = Tag::create([
            'name' => trim($validated['name']),
        ]);

        return response()->json([
            'success' => true,
            'data' => $tag,
            'message' => 'Тег успешно создан',
        ]);
    }

    public function getTags(): JsonResponse
    {
        $tags = Tag::orderBy('name')->get();

        return response()->json([
            'success' => true,
            'data' => $tags,
            'count' => $tags->count(),
        ]);
    }

    public function editTag(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id' => 'required|integer|exists:tags,id',
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('tags', 'name')->ignore($request->id),
            ],
        ]);

        $tag = Tag::findOrFail($validated['id']);
        $tag->update([
            'name' => trim($validated['name']),
        ]);

        return response()->json([
            'success' => true,
            'data' => $tag,
            'message' => 'Тег успешно обновлен',
        ]);
    }

    public function deleteTag($id): JsonResponse
    {
        validator(['id' => $id], [
            'id' => 'required|integer|exists:tags,id',
        ])->validate();

        $tag = Tag::findOrFail($id);
        $tag->delete();

        return response()->json([
            'success' => true,
            'message' => 'Тег успешно удален',
        ]);
    }

    public function getUsers(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => User::orderBy('id')->get(),
        ]);
    }

    public function blockUser(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'id' => 'required|integer|exists:users,id',
            'is_blocked' => 'required|in:true,false',
        ]);

        $user = User::findOrFail($validated['id']);
        $user->update([
            'is_blocked' => $validated['is_blocked'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $user->fresh(),
        ]);
    }

    public function getReports(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'data' => Report::latest()->get(),
        ]);
    }

    public function createReport(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'desc' => 'required|string|max:1000',
            'target' => 'required|string|max:255',
        ]);

        $report = Report::create([
            'desc' => trim($validated['desc']),
            'target' => trim($validated['target']),
        ]);

        return response()->json([
            'success' => true,
            'data' => $report,
        ]);
    }

    public function deleteReport($id): JsonResponse
    {
        validator(['id' => $id], [
            'id' => 'required|integer|exists:reports,id',
        ])->validate();

        $report = Report::findOrFail($id);
        $report->delete();

        return response()->json([
            'success' => true,
            'message' => 'Жалоба успешно удалена',
        ]);
    }
}
