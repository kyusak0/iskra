<?php

namespace App\Http\Controllers;

use App\Models\FriendRequest;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
        ]);

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => $request->password,
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'success' => true,
            'user' => $user,
            'token' => $token,
            'message' => 'Registration successful',
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if (!Auth::attempt($request->only('email', 'password'))) {
            return response()->json([
                'success' => false,
                'message' => 'Неверный email или пароль.',
            ], 422);
        }

        $user = User::where('email', $request->email)->firstOrFail();

        if ($user->is_blocked === 'true') {
            return response()->json([
                'success' => false,
                'message' => 'Ваш аккаунт заблокирован.',
            ], 423);
        }

        if ($user->google2fa_enabled) {
            $user->tokens()
                ->where('name', '2fa-login')
                ->delete();

            $loginToken = $user->createToken('2fa-login', ['2fa:verify'])->plainTextToken;

            return response()->json([
                'requires_2fa' => true,
                'login_token' => $loginToken,
            ]);
        }

        $token = $user->createToken('auth_token', ['*'])->plainTextToken;

        return response()->json([
            'requires_2fa' => false,
            'token' => $token,
            'user' => $user,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json([
            'message' => 'Logged out successfully',
        ]);
    }

    public function user(Request $request): JsonResponse
    {
        return response()->json($request->user());
    }

    public function userInfo(Request $request, $id): JsonResponse
    {
        $user = User::with([
            'posts', 'posts.source', 'sources', 'videos', 'reposts', 'reposts.posts', 'reposts.videos', 'reposts.posts.source', 'reposts.videos.cover'
        ])->findOrFail($id);

        $friendsCount = FriendRequest::query()
            ->accepted()
            ->where(function ($query) use ($user) {
                $query->where('sender_id', $user->id)
                    ->orWhere('receiver_id', $user->id);
            })
            ->count();

        $user->setAttribute('friends_count', $friendsCount);

        return response()->json([
            'success' => true,
            'data' => $user,
        ]);
    }

    public function setAvatar(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'avatar' => 'required|string|max:255',
        ]);

        $user = $request->user();
        $user->update([
            'avatar' => $validated['avatar'],
        ]);

        return response()->json([
            'success' => true,
            'data' => $user->fresh(),
        ]);
    }
}
