<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Tag;

class InfoController extends Controller
{
    public function createTag(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255|unique:tags,name',
        ], [
            'name.required' => trans('validation.custom.name.required'),
            'name.string' => trans('validation.custom.name.string'),
            'name.max' => trans('validation.custom.name.max'),
            'name.unique' => trans('validation.custom.name.unique'),
        ]);

        try {
            $tag = Tag::create([
                'name' => $validated['name'],
            ]);

            return response()->json([
                'success' => true,
                'data' => $tag,
                'message' => trans('messages.tag.created')
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => trans('messages.tag.create_error')
            ], 500);
        }
    }

    public function getTags()
    {
        try {
            $tags = Tag::orderBy('name')->get();

            return response()->json([
                'success' => true,
                'data' => $tags,
                'count' => $tags->count()
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => trans('messages.tag.fetch_error')
            ], 500);
        }
    }

    public function editTag(Request $request)
    {
        $validated = $request->validate([
            'id' => 'required|integer|exists:tags,id',
            'name' => [
                'required',
                'string',
                'max:255',
                Rule::unique('tags')->ignore($request->id),
            ],
        ], [
            'id.required' => trans('validation.custom.id.required'),
            'id.integer' => trans('validation.custom.id.integer'),
            'id.exists' => trans('validation.custom.id.exists'),
            'name.required' => trans('validation.custom.name.required'),
            'name.string' => trans('validation.custom.name.string'),
            'name.max' => trans('validation.custom.name.max'),
            'name.unique' => trans('validation.custom.name.unique_update'),
        ]);

        try {
            $tag = Tag::findOrFail($validated['id']);
            $tag->update([
                'name' => $validated['name'],
            ]);

            return response()->json([
                'success' => true,
                'data' => $tag,
                'message' => trans('messages.tag.updated')
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => trans('messages.tag.update_error')
            ], 500);
        }
    }

    public function deleteTag($id)
    {
        $validated = validator(['id' => $id], [
            'id' => 'required|integer|exists:tags,id',
        ], [
            'id.required' => trans('validation.custom.id.required'),
            'id.integer' => trans('validation.custom.id.integer'),
            'id.exists' => trans('validation.custom.id.exists'),
        ])->validate();

        try {
            $tag = Tag::findOrFail($validated['id']);

            $tag->delete();

            return response()->json([
                'success' => true,
                'message' => trans('messages.tag.deleted')
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => trans('messages.tag.delete_error')
            ], 500);
        }
    }
}
