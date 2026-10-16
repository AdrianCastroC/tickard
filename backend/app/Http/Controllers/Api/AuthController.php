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
                'nickname' => User::defaultNickname($data['first_name']),
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
            'nickname' => ['sometimes', 'required', 'string', 'regex:/^[a-z0-9_-]{3,30}$/'],
            'theme' => ['sometimes', Rule::in(['light', 'dark', 'system'])],
            'notify_in_app' => ['sometimes', 'boolean'],
            'notify_email' => ['sometimes', 'boolean'],
            'current_password' => ['required_with:password', 'current_password'],
            'password' => ['sometimes', 'string', 'min:8', 'confirmed'],
        ], [
            'nickname.prohibited' => 'El nickname es permanente. Para utilizar otro necesitas crear otra cuenta.',
            'email.prohibited' => 'El correo no puede modificarse desde el perfil sin un proceso de verificación.',
            'handle.prohibited' => 'El identificador público es permanente.',
        ]);

        // Apply only validated changes to a freshly loaded user. In
        // particular, stale/dirty attributes from a rejected identity change
        // must never leak into an otherwise valid profile update.
        $user = $request->user()->fresh();
        $payload = collect($data)->except(['current_password', 'password', 'password_confirmation'])->all();
        if (! empty($data['password'])) {
            $payload['password'] = $data['password'];
        }
        $user->update($payload);

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
