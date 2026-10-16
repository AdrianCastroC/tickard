<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class EmailChangeController extends ApiController
{
    public function status(Request $request)
    {
        $pending = DB::table('user_email_changes')->where('user_id', $request->user()->id)->first();
        if (! $pending || Carbon::parse($pending->expires_at)->isPast() || $pending->attempts >= 5) {
            return response()->json(['pending_email' => null, 'expires_at' => null]);
        }

        return response()->json([
            'pending_email' => $pending->new_email,
            'expires_at' => $pending->expires_at,
        ]);
    }

    public function requestChange(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'string', 'email:rfc', 'max:254', Rule::unique('users', 'email')],
            'current_password' => ['required', 'string', function ($attribute, $value, $fail) use ($request) {
                if (! Hash::check((string) $value, $request->user()->password)) {
                    $fail('La contraseña actual no es correcta.');
                }
            }],
        ]);

        $user = $request->user();
        $newEmail = trim($data['email']);
        if (Str::lower($newEmail) === Str::lower($user->email)) {
            throw ValidationException::withMessages(['email' => 'Introduce una dirección diferente a la actual.']);
        }

        if (User::whereRaw('LOWER(email) = ?', [Str::lower($newEmail)])->exists()) {
            throw ValidationException::withMessages(['email' => 'El correo ya pertenece a otra cuenta.']);
        }

        $pending = DB::table('user_email_changes')->where('user_id', $user->id)->first();
        if ($pending && Carbon::parse($pending->updated_at)->greaterThan(now()->subMinute())) {
            throw ValidationException::withMessages(['email' => 'Espera un minuto antes de solicitar otro código.']);
        }

        $code = (string) random_int(100000, 999999);
        DB::table('user_email_changes')->updateOrInsert(
            ['user_id' => $user->id],
            [
                'new_email' => $newEmail,
                'code_hash' => Hash::make($code),
                'attempts' => 0,
                'expires_at' => now()->addMinutes(15),
                'created_at' => now(),
                'updated_at' => now(),
            ]
        );

        // The current email remains active until the new inbox proves ownership.
        Mail::raw(
            "Tu código para confirmar el nuevo correo de Tickard es: {$code}\n\nCaduca en 15 minutos. Si no has solicitado este cambio, ignora el mensaje.",
            fn ($message) => $message->to($newEmail)->subject('Tickard — Confirmar nuevo correo')
        );

        return response()->json([
            'pending_email' => $newEmail,
            'expires_at' => now()->addMinutes(15)->toIso8601String(),
        ]);
    }

    public function confirm(Request $request)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'regex:/^[0-9]{6}$/'],
        ]);

        $userId = $request->user()->id;
        $result = DB::transaction(function () use ($userId, $data) {
            $pending = DB::table('user_email_changes')->where('user_id', $userId)->lockForUpdate()->first();
            if (! $pending || Carbon::parse($pending->expires_at)->isPast() || $pending->attempts >= 5) {
                throw ValidationException::withMessages(['code' => 'El código ha caducado o ya no es válido. Solicita uno nuevo.']);
            }

            if (! Hash::check($data['code'], $pending->code_hash)) {
                DB::table('user_email_changes')->where('user_id', $userId)
                    ->update(['attempts' => $pending->attempts + 1, 'updated_at' => now()]);
                return ['invalid_code' => true];
            }

            $user = User::whereKey($userId)->lockForUpdate()->firstOrFail();
            if (User::whereRaw('LOWER(email) = ?', [Str::lower($pending->new_email)])
                ->where('id', '!=', $userId)->exists()) {
                throw ValidationException::withMessages(['code' => 'El correo ya está siendo utilizado por otra cuenta.']);
            }

            $previous = $user->email;
            $user->email = $pending->new_email;
            $user->email_verified_at = now();
            $user->save();
            DB::table('user_email_changes')->where('user_id', $userId)->delete();
            return ['old_email' => $previous];
        });

        if (isset($result['invalid_code'])) {
            throw ValidationException::withMessages(['code' => 'El código no es correcto.']);
        }
        $oldEmail = $result['old_email'];

        // Inform the former address without making successful verification depend on mail delivery.
        try {
            Mail::raw(
                'Se ha cambiado la dirección de correo asociada a tu cuenta Tickard. Si no lo has solicitado, contacta con soporte.',
                fn ($message) => $message->to($oldEmail)->subject('Tickard — Tu correo ha cambiado')
            );
        } catch (\Throwable $exception) {
            Log::warning('No se pudo enviar el aviso de cambio de correo.', ['user_id' => $userId]);
        }

        return $this->profile($request->user()->fresh(), $request->integer('workspace_id') ?: null);
    }
}
