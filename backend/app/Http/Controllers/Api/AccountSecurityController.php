<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Laravel\Sanctum\PersonalAccessToken;

class AccountSecurityController extends ApiController
{
    private function context(Request $request): string
    {
        $token = $request->user()->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            return 'token:'.$token->getKey();
        }
        return 'session:'.($request->hasSession() ? $request->session()->getId() : 'test');
    }

    private function challenge(Request $request, string $purpose, bool $lock = false): ?object
    {
        $query = DB::table('account_security_challenges')
            ->where('user_id', $request->user()->id)
            ->where('purpose', $purpose);
        if ($lock) $query->lockForUpdate();
        $row = $query->first();
        if (! $row || ! hash_equals($row->auth_context, $this->context($request))
            || now()->greaterThanOrEqualTo($row->expires_at)) {
            return null;
        }
        return $row;
    }

    private function requireStage(Request $request, string $purpose, string $stage): object
    {
        $row = $this->challenge($request, $purpose, true);
        if (! $row || $row->stage !== $stage) {
            throw ValidationException::withMessages(['code' => 'La verificación ha caducado o no se ha completado. Inicia una nueva.']);
        }
        return $row;
    }

    private function notify(string $address, string $title, string $body): void
    {
        Mail::raw($body, fn ($message) => $message->to($address)->subject($title));
    }

    private function warnOldAddress(string $address, string $subject, string $body, int $userId): void
    {
        try {
            $this->notify($address, $subject, $body);
        } catch (\Throwable $error) {
            Log::warning('No se pudo entregar una alerta de seguridad de Tickard.', ['user_id' => $userId]);
        }
    }

    private function endOtherSessions(Request $request): void
    {
        $token = $request->user()->currentAccessToken();
        if ($token instanceof PersonalAccessToken) {
            $request->user()->tokens()->where('id', '!=', $token->getKey())->delete();
        }
    }

    public function status(Request $request, string $purpose)
    {
        abort_unless(in_array($purpose, ['email', 'password'], true), 404);
        $row = $this->challenge($request, $purpose);
        return response()->json([
            'stage' => $row?->stage,
            'new_email' => $row?->stage === 'new_code' ? $row->new_email : null,
            'expires_at' => $row?->expires_at,
        ]);
    }

    public function start(Request $request, string $purpose)
    {
        abort_unless(in_array($purpose, ['email', 'password'], true), 404);
        $existing = DB::table('account_security_challenges')
            ->where('user_id', $request->user()->id)->where('purpose', $purpose)->first();
        if ($existing && now()->lessThan(\Illuminate\Support\Carbon::parse($existing->updated_at)->addMinute())) {
            throw ValidationException::withMessages(['code' => 'Espera un minuto antes de solicitar otro código.']);
        }

        $code = (string) random_int(100000, 999999);
        $hash = Hash::make($code);
        DB::table('account_security_challenges')->updateOrInsert(
            ['user_id' => $request->user()->id, 'purpose' => $purpose],
            [
                'auth_context' => $this->context($request),
                'stage' => 'current_code',
                'code_hash' => $hash,
                'new_email' => null,
                'attempts' => 0,
                'expires_at' => now()->addMinutes(10),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        try {
            $this->notify($request->user()->email, 'Tickard — Código de seguridad',
                "Tu código de seguridad para ".($purpose === 'email' ? 'cambiar el correo' : 'cambiar la contraseña').
                " es: {$code}\n\nCaduca en 10 minutos. Si no has iniciado este proceso, ignora el mensaje.");
        } catch (\Throwable $error) {
            DB::table('account_security_challenges')
                ->where('user_id', $request->user()->id)->where('purpose', $purpose)
                ->where('code_hash', $hash)->delete();
            throw ValidationException::withMessages(['code' => 'No se pudo enviar el código de seguridad. Inténtalo más tarde.']);
        }
        return response()->json(['stage' => 'current_code', 'expires_at' => now()->addMinutes(10)->toIso8601String()]);
    }

    public function verifyCurrent(Request $request, string $purpose)
    {
        abort_unless(in_array($purpose, ['email', 'password'], true), 404);
        $data = $request->validate(['code' => ['required', 'string', 'regex:/^[0-9]{6}$/']]);
        $valid = DB::transaction(function () use ($request, $purpose, $data) {
            $row = $this->requireStage($request, $purpose, 'current_code');
            if ($row->attempts >= 5) {
                throw ValidationException::withMessages(['code' => 'Demasiados intentos. Solicita otro código.']);
            }
            $match = Hash::check($data['code'], $row->code_hash);
            DB::table('account_security_challenges')->where('id', $row->id)->update(
                $match
                    ? ['stage' => 'ready', 'code_hash' => null, 'attempts' => 0,
                        'expires_at' => now()->addMinutes(10), 'updated_at' => now()]
                    : ['attempts' => $row->attempts + 1, 'updated_at' => now()]
            );
            return $match;
        });
        if (! $valid) {
            throw ValidationException::withMessages(['code' => 'Código incorrecto.']);
        }
        return response()->json(['stage' => 'ready']);
    }

    public function requestNewEmail(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email:rfc', 'max:254', Rule::unique('users', 'email')],
            'current_password' => ['required', 'string', function ($attribute, $value, $fail) use ($request) {
                if (! Hash::check((string) $value, $request->user()->password)) {
                    $fail('La contraseña actual no es correcta.');
                }
            }],
        ]);
        $email = trim($data['email']);
        if (Str::lower($email) === Str::lower($request->user()->email)
            || User::whereRaw('LOWER(email) = ?', [Str::lower($email)])->exists()) {
            throw ValidationException::withMessages(['email' => 'Utiliza un correo nuevo que no esté registrado.']);
        }
        $code = (string) random_int(100000, 999999);
        $hash = Hash::make($code);
        $rowId = DB::transaction(function () use ($request, $email, $hash) {
            $row = $this->requireStage($request, 'email', 'ready');
            DB::table('account_security_challenges')->where('id', $row->id)->update([
                'stage' => 'new_code', 'new_email' => $email, 'code_hash' => $hash,
                'attempts' => 0, 'expires_at' => now()->addMinutes(10), 'updated_at' => now(),
            ]);
            return $row->id;
        });
        try {
            $this->notify($email, 'Tickard — Verificar nuevo correo',
                "Tu código para confirmar esta dirección como correo de Tickard es: {$code}\n\nCaduca en 10 minutos. Si no lo has solicitado, ignora el mensaje.");
        } catch (\Throwable $error) {
            DB::table('account_security_challenges')->where('id', $rowId)->where('code_hash', $hash)->delete();
            throw ValidationException::withMessages(['email' => 'No se pudo enviar el código al nuevo correo.']);
        }
        return response()->json(['stage' => 'new_code', 'new_email' => $email]);
    }

    public function confirmNewEmail(Request $request)
    {
        $data = $request->validate(['code' => ['required', 'string', 'regex:/^[0-9]{6}$/']]);
        $result = DB::transaction(function () use ($request, $data) {
            $row = $this->requireStage($request, 'email', 'new_code');
            if ($row->attempts >= 5) {
                throw ValidationException::withMessages(['code' => 'Demasiados intentos. Inicia otra verificación.']);
            }
            if (! Hash::check($data['code'], $row->code_hash)) {
                DB::table('account_security_challenges')->where('id', $row->id)
                    ->update(['attempts' => $row->attempts + 1, 'updated_at' => now()]);
                return ['invalid' => true];
            }
            $user = User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
            if (User::whereRaw('LOWER(email) = ?', [Str::lower($row->new_email)])
                    ->where('id', '!=', $user->id)->exists()) {
                throw ValidationException::withMessages(['email' => 'El correo ya pertenece a otra cuenta.']);
            }
            $old = $user->email;
            $user->email = $row->new_email;
            $user->email_verified_at = now();
            $user->save();
            DB::table('account_security_challenges')->where('id', $row->id)->delete();
            DB::table('user_email_changes')->where('user_id', $user->id)->delete();
            return ['old' => $old];
        });
        if (isset($result['invalid'])) {
            throw ValidationException::withMessages(['code' => 'Código incorrecto.']);
        }
        $this->endOtherSessions($request);
        $this->warnOldAddress($result['old'], 'Tickard — Cambio de correo confirmado',
            'El correo de tu cuenta Tickard se ha cambiado. Si no has sido tú, contacta con soporte.', $request->user()->id);
        return $this->profile($request->user()->fresh(), $request->integer('workspace_id') ?: null);
    }

    public function finishPassword(Request $request)
    {
        $data = $request->validate([
            'current_password' => ['required', 'string', function ($attribute, $value, $fail) use ($request) {
                if (! Hash::check((string) $value, $request->user()->password)) {
                    $fail('La contraseña actual no es correcta.');
                }
            }],
            'password' => ['required', 'string', 'max:128', Password::min(10)->mixedCase()->numbers()->symbols(), 'confirmed'],
        ]);
        DB::transaction(function () use ($request, $data) {
            $row = $this->requireStage($request, 'password', 'ready');
            $user = User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
            $user->password = $data['password'];
            $user->save();
            DB::table('account_security_challenges')->where('user_id', $user->id)->delete();
        });
        $this->endOtherSessions($request);
        $this->warnOldAddress($request->user()->email, 'Tickard — Contraseña modificada',
            'La contraseña de tu cuenta Tickard se ha cambiado. Si no has sido tú, contacta con soporte.', $request->user()->id);
        return $this->profile($request->user()->fresh(), $request->integer('workspace_id') ?: null);
    }
}
