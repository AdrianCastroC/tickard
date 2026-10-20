<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;

class RegistrationController extends ApiController
{
    public function register(Request $request)
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:120'],
            'last_name' => ['nullable', 'string', 'max:120'],
            'email' => ['required', 'email:rfc', 'max:254'],
            'password' => ['required', 'string', 'max:128',
                Password::min(10)->mixedCase()->numbers()->symbols(), 'confirmed'],
        ]);
        $email = Str::lower(trim($data['email']));
        $existing = User::whereRaw('LOWER(email) = ?', [$email])->first();
        // Previously unverified accounts may be securely reclaimed by their
        // actual mailbox owner. Any preexisting bearer tokens are then revoked.
        if ($existing?->email_verified_at) {
            throw ValidationException::withMessages(['email' => 'El correo ya está registrado.']);
        }

        $key = 'registration-email:'.hash('sha256', $email);
        abort_if(RateLimiter::tooManyAttempts($key, 5), 429,
            'Demasiadas solicitudes de verificación para este correo.');
        $recent = DB::table('pending_registrations')->where('email', $email)->first();
        if ($recent && now()->lessThan(\Illuminate\Support\Carbon::parse($recent->updated_at)->addMinute())) {
            throw ValidationException::withMessages([
                'email' => 'Espera un minuto antes de volver a solicitar otro código.',
            ]);
        }

        $nonce = bin2hex(random_bytes(32));
        $code = (string) random_int(100000, 999999);
        $values = [
            'first_name' => trim($data['first_name']),
            'last_name' => trim($data['last_name'] ?? '') ?: null,
            'password_hash' => Hash::make($data['password']),
            'nonce_hash' => hash('sha256', $nonce),
            'code_hash' => Hash::make($code),
            'attempts' => 0,
            'expires_at' => now()->addMinutes(15),
            'updated_at' => now(),
        ];

        DB::table('pending_registrations')->updateOrInsert(
            ['email' => $email],
            [...$values, 'created_at' => now()]
        );

        try {
            Mail::raw(
                "Tu código para verificar el correo y activar Tickard es: {$code}\n\n".
                'Caduca en 15 minutos. Si no te has registrado, ignora este mensaje.',
                function ($message) use ($email) {
                    $message->to($email)->subject('Tickard — Verifica tu correo');
                }
            );
        } catch (\Throwable $exception) {
            DB::table('pending_registrations')->where('email', $email)
                ->where('nonce_hash', hash('sha256', $nonce))->delete();
            throw ValidationException::withMessages([
                'email' => 'No se ha podido enviar el correo. Inténtalo más tarde.',
            ]);
        }
        RateLimiter::hit($key, 3600);

        // A registration nonce is not an authentication token: it cannot
        // activate an account without the separate code delivered by email.
        return response()->json([
            'verification_required' => true,
            'email' => $email,
            'nonce' => $nonce,
            'expires_in' => 900,
        ], 202);
    }

    public function verify(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email:rfc', 'max:254'],
            'nonce' => ['required', 'string', 'regex:/^[a-f0-9]{64}$/'],
            'code' => ['required', 'string', 'regex:/^[0-9]{6}$/'],
        ]);
        $email = Str::lower(trim($data['email']));
        $result = DB::transaction(function () use ($email, $data) {
            $pending = DB::table('pending_registrations')
                ->where('email', $email)->lockForUpdate()->first();
            if (! $pending || now()->greaterThanOrEqualTo($pending->expires_at)
                || $pending->attempts >= 5) {
                return ['invalid' => true];
            }
            // Only the browser that initiated registration can consume code
            // attempts. An outsider who only knows an email must not be able
            // to lock someone else's pending registration with bogus nonces.
            if (! hash_equals($pending->nonce_hash, hash('sha256', $data['nonce']))) {
                return ['invalid' => true];
            }
            if (! Hash::check($data['code'], $pending->code_hash)) {
                DB::table('pending_registrations')->where('id', $pending->id)
                    ->update(['attempts' => $pending->attempts + 1]);
                return ['invalid' => true];
            }

            $user = User::whereRaw('LOWER(email) = ?', [$email])->lockForUpdate()->first();
            if ($user?->email_verified_at) {
                return ['invalid' => true];
            }
            if ($user) {
                $user->forceFill([
                    'first_name' => $pending->first_name,
                    'last_name' => $pending->last_name,
                    'password' => $pending->password_hash,
                    'email_verified_at' => now(),
                ])->save();
                $user->tokens()->delete();
                if (! $user->ownedWorkspaces()->exists()) {
                    Workspace::createInitialFor($user);
                }
            } else {
                $user = User::create([
                    'first_name' => $pending->first_name,
                    'last_name' => $pending->last_name,
                    'email' => $email,
                    'password' => $pending->password_hash,
                ]);
                $user->forceFill(['email_verified_at' => now()])->save();
                Workspace::createInitialFor($user);
            }

            DB::table('pending_registrations')->where('id', $pending->id)->delete();
            return ['user' => $user];
        });

        if (isset($result['invalid'])) {
            throw ValidationException::withMessages([
                'code' => 'El código no coincide, ha caducado o se han agotado los intentos.',
            ]);
        }
        $user = $result['user'];
        return response()->json([
            'token' => $user->createToken('api')->plainTextToken,
            'user' => $this->profile($user),
        ], 201);
    }
}
