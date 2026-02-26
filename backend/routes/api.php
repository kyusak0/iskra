<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

use App\Http\Controllers\AuthController;
use App\Http\Controllers\PostController;
use App\Http\Controllers\DebateController;

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);

Route::get('/get-posts', [PostController::class, 'getPosts']);

Route::get('/user-info/{id}', [AuthController::class, 'userInfo']);

Route::middleware('auth:sanctum')->group(function () {
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/user', [AuthController::class, 'user']);

    Route::post('/create-post', [PostController::class, 'createPost']);

    Route::post('/create-chat', [DebateController::class, 'createChat']);
    Route::post('/send-message/post', [DebateController::class, 'sendMessage']);
    Route::post('/send-message/chat', [DebateController::class, 'sendMessage']);
    Route::get('/get-chats', [DebateController::class, 'getChats']);
    Route::post('/get-messages/chat/{id}', [DebateController::class, 'getMessages']);
    Route::post('/get-messages/post/{id}', [DebateController::class, 'getMessages']);
    Route::post('/delete-message', [DebateController::class, 'deleteMessage']);
});