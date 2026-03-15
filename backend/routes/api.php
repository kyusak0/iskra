<?php

use App\Http\Controllers\Api\TwoFactorController as ApiTwoFactorController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\AuthController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\DebateController;
use App\Http\Controllers\SourceController;
use App\Http\Controllers\InfoController;

use App\Http\Controllers\TwoFactorController;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::get('/get-posts', [PostController::class, 'getPosts']);
Route::get('/get-post/{url}', [PostController::class, 'getPostInfo']);

Route::get('/get-videos', [PostController::class, 'getVideos']);
Route::get('/get-video/{id}', [PostController::class, 'getVideoInfo']);
Route::get('/view/{id}', [PostController::class, 'view']);
Route::get('/check-upload-limits', function() {
    return response()->json([
        'upload_max_filesize' => ini_get('upload_max_filesize'),
        'post_max_size' => ini_get('post_max_size'),
        'max_execution_time' => ini_get('max_execution_time'),
        'memory_limit' => ini_get('memory_limit'),
        'max_file_uploads' => ini_get('max_file_uploads'),
    ]);
});
Route::post('/get-messages/post/{id}', [DebateController::class, 'getMessages']);

Route::get('/user-info/{id}', [AuthController::class, 'userInfo']);

    Route::get('/get-tags', [InfoController::class, 'getTags']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/set-avatar', [AuthController::class, 'setAvatar']);

    Route::post('/create-post', [PostController::class, 'createPost']);
    Route::post('/create-video', [PostController::class, 'createVideo']);

    Route::post('/load-file', [SourceController::class, 'loadFile']);

    Route::post('/create-chat', [DebateController::class, 'createChat']);
    Route::post('/get-or-create-personal-chat', [DebateController::class, 'createChatPersonal']);
    
    Route::post('/send-message/post/{id}', [DebateController::class, 'sendMessage']);
    Route::post('/send-message/chat', [DebateController::class, 'sendMessage']);
    Route::post('/send-message/video/{id}', [DebateController::class, 'sendMessage']);

    Route::post('/commentable/video', [DebateController::class, 'commentable']);
    Route::post('/commentable/chat', [DebateController::class, 'commentable']);
    Route::post('/commentable/post', [DebateController::class, 'commentable']);

    Route::post('/repost', [DebateController::class, 'repost']);

    Route::post('/delete-message', [DebateController::class, 'deleteMessage']);
    Route::get('/get-chats', [DebateController::class, 'getChats']);
    Route::get('/get-chat-info/{id}', [DebateController::class, 'getChatInfo']);
    Route::get('/get-chat-by-url/{url}', [DebateController::class, 'getChatUrl']);
    Route::post('/pin-message', [DebateController::class, 'pinMess']);

    Route::post('/get-messages/chat/{id}', [DebateController::class, 'getMessages']);
    Route::post('/subscribe', [DebateController::class, 'subscribe']);

    Route::post('/create-tag', [InfoController::class, 'createTag']);
    Route::post('/edit-tag', [InfoController::class, 'editTag']);
    Route::get('/delete-tag/{id}', [InfoController::class, 'deleteTag']);

    Route::get('/get-reports', [InfoController::class, 'getReports']);
    Route::post('/create-report', [InfoController::class, 'createReport']);
    Route::get('/delete-report/{id}', [InfoController::class, 'deleteReport']);

    Route::get('/get-users', [InfoController::class, 'getUsers']);
    Route::post('/block-user', [InfoController::class, 'blockUser']);
});

Route::post('/2fa/verify-login', [TwoFactorController::class, 'verifyLoginCode'])
    ->middleware(['auth:sanctum', 'abilities:2fa:verify']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/2fa/setup', [TwoFactorController::class, 'setup']);
    Route::post('/2fa/confirm', [TwoFactorController::class, 'confirm']);
    Route::post('/2fa/disable', [TwoFactorController::class, 'disable']);
    // Route::post('/2fa/verify-login', [TwoFactorController::class, 'verifyLoginCode']);
});

// Route::middleware(['auth:sanctum', 'abilities:has2fa'])-group(function (){
    
// })

// Route::middleware(['auth:sanctum', '2fa.verified'])->group(function () {
//     Route::get('/user', fn (Request $request) => $request->user());
//     // все остальные защищённые роуты
// });