<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\ApiController;
use App\Models\AppNotification;
use App\Models\Board;
use App\Models\BoardCategory;
use App\Models\Card;
use App\Models\CardAttachment;
use App\Models\CardChecklistItem;
use App\Models\CardModule;
use App\Models\ClientCompany;
use App\Models\Column;
use App\Models\Comment;
use App\Models\Department;
use App\Models\Invitation;
use App\Models\Label;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Support\CardPresenter;
use App\Support\Notifier;
use App\Support\ProjectAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends ApiController
{
    public function login(Request $request)
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => 'El correo o la contraseña no coinciden.',
            ]);
        }

        return [
            'token' => $user->createToken('api')->plainTextToken,
            'user' => $this->profile($user),
        ];
    }

    public function register(Request $request)
    {
        $data = $request->validate([
            'first_name' => ['required', 'string', 'max:120'],
            'last_name' => ['nullable', 'string', 'max:120'],
            'email' => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ]);

        $user = DB::transaction(function () use ($data) {
            $user = User::create([
                'first_name' => trim($data['first_name']),
                'last_name' => trim($data['last_name'] ?? '') ?: null,
                'email' => $data['email'],
                'password' => $data['password'],
            ]);
            Workspace::createInitialFor($user);

            return $user;
        });

        return response()->json([
            'token' => $user->createToken('api')->plainTextToken,
            'user' => $this->profile($user),
        ], 201);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->noContent();
    }

    public function me(Request $request)
    {
        $workspaceId = $request->integer('workspace_id') ?: null;
    
        return $this->profile(
            $request->user(),
            $workspaceId
        );
    }

    public function updateMe(Request $request)
    {
        $data = $request->validate([
            'first_name' => ['sometimes', 'required', 'string', 'max:120'],
            'last_name' => ['sometimes', 'nullable', 'string', 'max:120'],
            // Public identity is created at registration and cannot be modified.
            'nickname' => ['prohibited'],
            'email' => ['prohibited'],
            'name' => ['prohibited'],
            'id' => ['prohibited'],
            'handle' => ['prohibited'],
            'public_handle' => ['prohibited'],
            'theme' => ['sometimes', Rule::in(['light', 'dark', 'system'])],
            'notify_in_app' => ['sometimes', 'boolean'],
            'notify_email' => ['sometimes', 'boolean'],
            'birthday_month_day' => ['sometimes', 'nullable', 'regex:/^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/'],
            'share_birthday' => ['sometimes', 'boolean'],
            'professional_phone' => ['sometimes', 'nullable', 'string', 'max:30', 'regex:/^\\+?[0-9 ().-]{6,30}$/'],
            'current_password' => ['prohibited'],
            'password' => ['prohibited'],
            'password_confirmation' => ['prohibited'],
        ], [
            'nickname.prohibited' => 'El ID de la cuenta es permanente. Para utilizar otro necesitas crear otra cuenta.',
            'email.prohibited' => 'El correo no puede modificarse desde el perfil sin un proceso de verificación.',
            'handle.prohibited' => 'El identificador público es permanente.',
            'public_handle.prohibited' => 'El ID de la cuenta es permanente.',
        ]);

        if (array_key_exists('birthday_month_day', $data) && $data['birthday_month_day'] !== null) {
            [$month, $day] = array_map('intval', explode('-', $data['birthday_month_day']));
            if (! checkdate($month, $day, 2000)) {
                throw ValidationException::withMessages(['birthday_month_day' => 'La fecha de cumpleaños no es válida.']);
            }
        }
        if (array_key_exists('share_birthday', $data) && $data['share_birthday']) {
            $birthday = $data['birthday_month_day'] ?? $request->user()->birthday_month_day;
            if (! $birthday) {
                throw ValidationException::withMessages(['share_birthday' => 'Indica primero tu cumpleaños para poder compartirlo.']);
            }
        }
        if (array_key_exists('birthday_month_day', $data) && $data['birthday_month_day'] === null) {
            // Clearing a birthday revokes sharing at the same time.
            $data['share_birthday'] = false;
        }

        // Apply only validated changes to a freshly loaded user. In
        // particular, stale/dirty attributes from a rejected identity change
        // must never leak into an otherwise valid profile update.
        $user = $request->user()->fresh();
        $user->update($data);

        $workspaceId = $request->integer('workspace_id') ?: null;

        return $this->profile(
            $user->fresh(),
            $workspaceId
        );
    }

    public function updateAvatar(Request $request)
    {
        $data = $request->validate([
            'avatar' => ['required', 'image', 'max:5120'],
        ]);

        $user = $request->user();
        if ($user->avatar_path) {
            Storage::disk('public')->delete($user->avatar_path);
        }

        $path = $data['avatar']->store('avatars/'.$user->id, 'public');
        $user->update(['avatar_path' => $path]);

        $workspaceId = $request->integer('workspace_id') ?: null;

        return $this->profile(
            $user->fresh(),
            $workspaceId
        );
    }

    public function notifications(Request $request)
    {
        return AppNotification::where('user_id', $request->user()->id)->latest()->limit(20)->get()->map(fn ($item) => [
            'id' => $item->id,
            'body' => $item->body,
            'read_at' => $item->read_at,
        ]);
    }

    public function readNotifications(Request $request)
    {
        AppNotification::where('user_id', $request->user()->id)->whereNull('read_at')->update(['read_at' => now()]);

        return response()->noContent();
    }
}
