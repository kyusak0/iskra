<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Tag;

class InfoController extends Controller
{
    public function createTag(Request $request){
        $tag = Tag::create([
            'name' => $request->name,
        ]);

        if(!empty($tag)){
            return response()->json([
                'success' => true,
                'data' => $tag,
            ]);
        }
        return response()->json([
            'success' => false,
        ]);
    }

    public function getTags () {
        $tags = Tag::all();

        return response()->json([
            'success' => true,
            'data' => $tags,
        ]);
    }

    public function editTag(Request $request){
        $tag = Tag::findOrFail($request->id)
                ->update([
                    'name' => $request->name,
                ]);

        return response()->json([
            'success' => true,
        ]);
    }

    public function deleteTag($id){
        Tag::findOrFail($id)->delete();

        return response()->json([
            'success' => true,
        ]);
    }
}
