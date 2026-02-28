<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

use App\Models\Source;

class SourceController extends Controller
{
    public function loadFile(Request $request){
        $request->validate([
            'file' => 'required|file|max:2000000|mimes:jpg,jpeg,png,gif,pdf,mp4,doc,docx,ppt,pptx,xls,xlsx,txt',
            'author_id' => 'required|exists:users,id',
        ]);

        $uploadedFile = $request->file('file');

        
        $path = $uploadedFile->store('uploads', 'public');

        $file = new Source();
        $file->name = $path;
        $file->type = $uploadedFile->getMimeType();
        $file->size = $uploadedFile->getSize();
        $file->author_id = $request->author_id;
        $file->save();

        if(!empty($file)){
            return response()->json([
                'message' => 'success',
                'data' => $file
            ]);
        }

        return response()->json([
            'message' => 'failed',
        ]);

    }
}
