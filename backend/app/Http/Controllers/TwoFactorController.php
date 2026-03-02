<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Crypt;
use PragmaRX\Google2FALaravel\Facade as Google2FA;

class TwoFactorController extends Controller
{
    public function setup(Request $request)
    {
        $user = $request->user();

        if (!$user->google2fa_secret) {
            $secret = Google2FA::generateSecretKey();

            $user->google2fa_secret = Crypt::encryptString($secret);
            $user->save();
        } else {
            $secret = Crypt::decryptString($user->google2fa_secret);
        }

        $companyName = config('app.name', 'MyApp');
        $email = $user->email;

        // otpauth URL для QR
        $otpauthUrl = Google2FA::getQRCodeUrl(
            $companyName,
            $email,
            $secret
        );

        return response()->json([
            'secret' => $secret, // можно НЕ отдавать на фронт, если не хочешь
            'otpauth_url' => $otpauthUrl,
            'enabled' => (bool) $user->google2fa_enabled,
        ]);
    }
    public function confirm(Request $request)
{
    $request->validate([
        'code' => ['required', 'digits:6'],
    ]);

    $user = $request->user();

    if (!$user->google2fa_secret) {
        return response()->json([
            'message' => '2FA setup not initialized.',
        ], 422);
    }

    $secret = \Illuminate\Support\Facades\Crypt::decryptString($user->google2fa_secret);

    $valid = app('pragmarx.google2fa')->verifyKey($secret, $request->code, 2);

    if (!$valid) {
        return response()->json([
            'message' => 'Invalid authentication code.',
        ], 422);
    }

    $user->google2fa_enabled = true;
    $user->google2fa_confirmed_at = now();
    $user->save();

    return response()->json([
        'message' => 'Two-factor authentication enabled.',
    ]);
}
    public function disable(Request $request)
{
    $data = $request->validate([
        'email' => ['required', 'email'],
        'password' => ['required', 'current_password'],
        'code' => ['required', 'digits:6'],
    ]);

    $user = $request->user();

    if (!$user->google2fa_enabled || !$user->google2fa_secret) {
        return response()->json([
            'message' => '2FA is not enabled.',
        ], 422);
    }

    if ($data['email'] !== $user->email) {
        return response()->json([
            'message' => 'Email does not match the current account.',
        ], 422);
    }

    $secret = \Illuminate\Support\Facades\Crypt::decryptString($user->google2fa_secret);

    $valid = app('pragmarx.google2fa')->verifyKey($secret, $data['code'], 2);

    if (!$valid) {
        return response()->json([
            'message' => 'Invalid authentication code.',
        ], 422);
    }

    $user->google2fa_secret = null;
    $user->google2fa_enabled = false;
    $user->google2fa_confirmed_at = null;
    $user->save();

    return response()->json([
        'message' => 'Two-factor authentication disabled.',
    ]);
}
    public function verifyLoginCode(Request $request)
    {
        $data = $request->validate([
            'code' => ['required', 'digits:6'],
        ]);

        $user = $request->user();

        if (!$user || !$user->google2fa_enabled || !$user->google2fa_secret) {
            return response()->json([
                'message' => '2FA is not available.',
            ], 422);
        }

        $secret = \Illuminate\Support\Facades\Crypt::decryptString($user->google2fa_secret);

        $valid = app('pragmarx.google2fa')->verifyKey($secret, $data['code'], 2);

        if (!$valid) {
            return response()->json([
                'message' => 'Invalid authentication code.',
            ], 422);
        }

        // удалить временный 2FA токен
        $tempToken = $user->currentAccessToken();
        if ($tempToken) {
            $tempToken->delete();
        }

        // выдать обычный токен
        $fullToken = $user->createToken('auth_token', ['*'])->plainTextToken;

        return response()->json([
            'token' => $fullToken,
            'user' => $user,
        ]);
    }
}
