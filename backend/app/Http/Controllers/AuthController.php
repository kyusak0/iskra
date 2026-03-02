<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
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
            'user' => $user,
            'token' => $token,
            'message' => 'Registration successful'
        ], 201);
    }

    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required',
        ]);

        if (!Auth::attempt($request->only('email', 'password'))) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $user = User::where('email', $request->email)->firstOrFail();
        if ($user->google2fa_enabled) {
            // по желанию: удалить старые временные 2FA-токены
            $user->tokens()
                ->where('name', '2fa-login')
                ->delete();

            $loginToken = $user->createToken('2fa-login', ['2fa:verify'])->plainTextToken;

            return response()->json([
                'requires_2fa' => true,
                'login_token' => $loginToken,
            ]);
        }

        // Обычный вход без 2FA
        $token = $user->createToken('auth_token', ['*'])->plainTextToken;

        return response()->json([
            'requires_2fa' => false,
            'token' => $token,
            'user' => $user,
        ]);


    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out successfully'
        ]);
    }

    public function user(Request $request)
    {
        return response()->json($request->user());
    }

    public function userInfo($id){
        $user = User::with([
            'posts', 'posts.source'
        ])->findOrFail($id);
        if($user){
            return response()->json([
            'data' => $user,
            'success' => true,
        ]);
        }
        return response()->json([
            'success' => false,
        ]);
    }
}