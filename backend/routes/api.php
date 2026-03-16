<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\DebateController;
use App\Http\Controllers\FriendController;
use App\Http\Controllers\InfoController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\SourceController;
use App\Http\Controllers\TwoFactorController;
use Illuminate\Support\Facades\Route;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::get('/get-posts', [PostController::class, 'getPosts']);
Route::get('/get-post/{url}', [PostController::class, 'getPostInfo']);
Route::get('/get-videos', [PostController::class, 'getVideos']);
Route::get('/get-video/{id}', [PostController::class, 'getVideoInfo']);
Route::get('/view/{id}', [PostController::class, 'view']);
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
    Route::get('/ws/chat-access/{id}', [DebateController::class, 'wsChatAccess']);

    Route::post('/send-message/post/{id}', [DebateController::class, 'sendMessage']);
    Route::post('/send-message/chat', [DebateController::class, 'sendMessage']);
    Route::post('/send-message/video/{id}', [DebateController::class, 'sendMessage']);

    Route::post('/commentable/video', [DebateController::class, 'commentable']);
    Route::post('/commentable/chat', [DebateController::class, 'commentable']);
    Route::post('/commentable/post', [DebateController::class, 'commentable']);

    Route::post('/repost', [DebateController::class, 'repost']);
    Route::post('/delete-message', [DebateController::class, 'deleteMessage']);
    Route::post('/pin-message', [DebateController::class, 'pinMess']);
    Route::post('/subscribe', [DebateController::class, 'subscribe']);
    Route::post('/messages/read', [DebateController::class, 'markMessagesRead']);

    Route::get('/friends', [FriendController::class, 'index']);
    Route::get('/friends/stats', [FriendController::class, 'stats']);
    Route::get('/friends/relation/{id}', [FriendController::class, 'relation']);
    Route::post('/friends/request', [FriendController::class, 'sendRequest']);
    Route::post('/friends/accept', [FriendController::class, 'accept']);
    Route::post('/friends/decline', [FriendController::class, 'decline']);
    Route::post('/friends/cancel', [FriendController::class, 'cancel']);
    Route::post('/friends/remove', [FriendController::class, 'remove']);
    Route::post('/friends/block', [FriendController::class, 'block']);
    Route::post('/friends/unblock', [FriendController::class, 'unblock']);

    Route::get('/get-chats', [DebateController::class, 'getChats']);
    Route::get('/get-chat-info/{id}', [DebateController::class, 'getChatInfo']);
    Route::get('/get-chat-by-url/{url}', [DebateController::class, 'getChatUrl']);
    Route::post('/get-messages/chat/{id}', [DebateController::class, 'getMessages']);

    Route::post('/create-report', [InfoController::class, 'createReport']);
});

Route::middleware(['auth:sanctum', 'admin'])->group(function () {
    Route::post('/create-tag', [InfoController::class, 'createTag']);
    Route::post('/edit-tag', [InfoController::class, 'editTag']);
    Route::get('/delete-tag/{id}', [InfoController::class, 'deleteTag']);

    Route::get('/get-reports', [InfoController::class, 'getReports']);
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
});
