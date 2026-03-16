<?php

namespace App\Http\Controllers;

use App\Models\Source;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SourceController extends Controller
{
    public function loadFile(Request $request): JsonResponse
    {
        $request->validate([
            'file' => 'required|file|max:2000000',
        ]);

        $uploadedFile = $request->file('file');
        $path = $uploadedFile->store('uploads', 'public');

        $file = new Source();
        $file->name = $path;
        $file->type = $uploadedFile->getMimeType();
        $file->size = $uploadedFile->getSize();
        $file->author_id = $request->user()->id;
        $file->save();

        return response()->json([
            'success' => true,
            'message' => 'success',
            'data' => $file,
        ]);
    }
}
