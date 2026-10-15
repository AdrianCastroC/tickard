<?php

namespace App\Http\Controllers\Api;

use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Support\WorkspaceLimits;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class WorkspaceInvitationsController extends ApiController
{
    private function authorizeOwner(Request $request, Workspace $workspace): void
    {
        abort_unless((int) $workspace->owner_id === (int) $request->user()->id, 403);
    }

    private function currentInvitation(string $token): WorkspaceInvitation
    {
        $invitation = WorkspaceInvitation::query()
            ->where('token_hash', hash('sha256', $token))
            ->with('workspace')
            ->firstOrFail();

        abort_if(
            $invitation->revoked_at !== null
                || $invitation->expires_at->isPast()
                || $invitation->used_count >= $invitation->max_uses,
            410,
            'La invitación ha caducado o ya no está disponible.'
        );

        return $invitation;
    }

    public function index(Request $request, Workspace $workspace)
    {
        $this->authorizeOwner($request, $workspace);

        $members = $workspace->memberships()->with('user:id,name,email,avatar_path')
            ->orderBy('id')->get()
            ->filter(fn ($member) => $member->user !== null)
            ->map(fn ($member) => [
                'id' => $member->user->id,
                'name' => $member->user->name,
                'email' => $member->user->email,
                'avatar_url' => $member->user->avatarUrl(),
                'role' => $member->role,
            ])->values();

        $invitations = WorkspaceInvitation::where('workspace_id', $workspace->id)
            ->whereNull('revoked_at')->where('expires_at', '>', now())
            ->whereColumn('used_count', '<', 'max_uses')
            ->orderByDesc('id')->get()
            ->map(fn ($invitation) => [
                'id' => $invitation->id,
                'email' => $invitation->email,
                'type' => $invitation->email ? 'email' : 'link',
                'max_uses' => $invitation->max_uses,
                'used_count' => $invitation->used_count,
                'expires_at' => $invitation->expires_at->toIso8601String(),
                'created_at' => $invitation->created_at->toIso8601String(),
            ]);

        $limit = WorkspaceLimits::maxMembers($workspace);

        return response()->json([
            'members' => $members,
            'invitations' => $invitations,
            'member_limit' => $limit,
            'member_count' => $workspace->memberships()->count(),
            'can_invite' => WorkspaceLimits::canAddMember($workspace),
        ]);
    }

    public function store(Request $request, Workspace $workspace)
    {
        $this->authorizeOwner($request, $workspace);

        $data = $request->validate([
            'mode' => ['required', 'in:email,link'],
            'email' => ['required_if:mode,email', 'nullable', 'email', 'max:255'],
            'expires_days' => ['required', 'integer', 'min:1', 'max:30'],
            'max_uses' => ['required', 'integer', 'min:1', 'max:50'],
        ]);

        abort_unless(WorkspaceLimits::canAddMember($workspace), 422, 'No quedan plazas libres en este Workspace.');

        $email = $data['mode'] === 'email' ? Str::lower(trim($data['email'])) : null;
        if ($email) {
            if ($workspace->members()->whereRaw('LOWER(users.email) = ?', [$email])->exists()) {
                throw ValidationException::withMessages(['email' => 'Este usuario ya pertenece al Workspace.']);
            }
            $existing = WorkspaceInvitation::where('workspace_id', $workspace->id)
                ->whereRaw('LOWER(email) = ?', [$email])->whereNull('revoked_at')
                ->where('expires_at', '>', now())->whereColumn('used_count', '<', 'max_uses')->exists();
            if ($existing) {
                throw ValidationException::withMessages(['email' => 'Ya existe una invitación pendiente para este correo.']);
            }
        }

        $token = Str::random(64);
        $invitation = WorkspaceInvitation::create([
            'workspace_id' => $workspace->id,
            'invited_by' => $request->user()->id,
            'email' => $email,
            'token_hash' => hash('sha256', $token),
            'max_uses' => $email ? 1 : $data['max_uses'],
            'used_count' => 0,
            'expires_at' => now()->addDays((int) $data['expires_days']),
        ]);

        $base = rtrim((string) (config('app.frontend_url') ?: $request->getSchemeAndHttpHost()), '/');
        $url = $base.'/invitar/workspace/'.$token;

        if ($email) {
            try {
                Mail::raw(
                    "Te han invitado al Workspace «{$workspace->name}» en Tickard.\n\n".
                    "Puedes acceder o registrarte y aceptar la invitación aquí:\n{$url}\n\n".
                    "La invitación caduca en {$data['expires_days']} días. Si no la esperabas, ignora este mensaje.",
                    fn ($message) => $message->to($email)->subject('Invitación a '.$workspace->name.' · Tickard')
                );
            } catch (\Throwable $error) {
                $invitation->delete();
                throw $error;
            }
        }

        return response()->json([
            'id' => $invitation->id,
            'url' => $url,
            'type' => $email ? 'email' : 'link',
            'expires_at' => $invitation->expires_at->toIso8601String(),
        ], 201);
    }

    public function show(string $token)
    {
        $invitation = $this->currentInvitation($token);

        return response()->json([
            'workspace' => $invitation->workspace->name,
            'email' => $invitation->email,
            'type' => $invitation->email ? 'email' : 'link',
            'expires_at' => $invitation->expires_at->toIso8601String(),
        ]);
    }

    public function accept(Request $request, string $token)
    {
        $user = $request->user();
        $workspaceId = DB::transaction(function () use ($token, $user) {
            // Lock the workspace first to serialize concurrent acceptances
            // against the same seat limit, even across different invitations.
            $invitationInfo = $this->currentInvitation($token);
            $workspace = Workspace::query()->whereKey($invitationInfo->workspace_id)
                ->lockForUpdate()->firstOrFail();
            $invitation = WorkspaceInvitation::whereKey($invitationInfo->id)
                ->lockForUpdate()->firstOrFail();

            abort_if($invitation->revoked_at || $invitation->expires_at->isPast()
                || $invitation->used_count >= $invitation->max_uses, 410,
                'La invitación ya no está disponible.');

            abort_if($invitation->email && Str::lower($user->email) !== $invitation->email,
                403, 'Accede con la cuenta del correo al que se envió la invitación.');

            abort_if($workspace->memberships()->where('user_id', $user->id)->exists(),
                409, 'Ya perteneces a este Workspace.');
            abort_unless(WorkspaceLimits::canAddMember($workspace), 422,
                'El Workspace ha alcanzado el límite de miembros de su plan.');

            $workspace->memberships()->create(['user_id' => $user->id, 'role' => 'member']);
            $invitation->increment('used_count');

            return $workspace->id;
        });

        return response()->json(['workspace_id' => $workspaceId]);
    }

    public function destroy(Request $request, Workspace $workspace, WorkspaceInvitation $invitation)
    {
        $this->authorizeOwner($request, $workspace);
        abort_unless((int) $invitation->workspace_id === (int) $workspace->id, 404);
        $invitation->update(['revoked_at' => now()]);

        return response()->noContent();
    }
}
