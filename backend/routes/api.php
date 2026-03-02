<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\AuthController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\DebateController;
use App\Http\Controllers\SourceController;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::get('/get-posts', [PostController::class, 'getPosts']);
Route::get('/get-post/{id}', [PostController::class, 'getPostInfo']);

Route::post('/get-messages/post/{id}', [DebateController::class, 'getMessages']);

Route::get('/user-info/{id}', [AuthController::class, 'userInfo']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

    Route::post('/create-post', [PostController::class, 'createPost']);

    Route::post('/load-file', [SourceController::class, 'loadFile']);

    Route::post('/create-chat', [DebateController::class, 'createChat']);
    Route::post('/send-message/post', [DebateController::class, 'sendMessage']);
    Route::post('/send-message/chat', [DebateController::class, 'sendMessage']);
    Route::post('/delete-message', [DebateController::class, 'deleteMessage']);
    Route::get('/get-chats', [DebateController::class, 'getChats']);
    Route::get('/get-chat-info/{id}', [DebateController::class, 'getChatInfo']);
    Route::post('/get-messages/chat/{id}', [DebateController::class, 'getMessages']);
    

});