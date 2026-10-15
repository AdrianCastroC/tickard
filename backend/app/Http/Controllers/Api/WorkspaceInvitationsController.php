<?php

namespace App\Http\Controllers\Api;

use App\Models\AppNotification;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Support\ProjectAccess;
use App\Support\WorkspaceLimits;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class WorkspaceInvitationsController extends ApiController
{
    private function isOwner(User $user, Workspace $workspace): bool
    {
        return (int) $workspace->owner_id === (int) $user->id;
    }

    private function projectFor(Workspace $workspace, ?int $projectId): ?Project
    {
        if ($projectId === null) return null;

        return $workspace->projects()->findOrFail($projectId);
    }

    private function present(WorkspaceInvitation $invitation): array
    {
        return [
            'id' => $invitation->id,
            'workspace_id' => $invitation->workspace_id,
            'workspace_name' => $invitation->workspace?->name,
            'project_id' => $invitation->project_id,
            'project_name' => $invitation->project?->name,
            'project_role' => $invitation->project_role,
            'status' => $invitation->status,
            'user' => $invitation->recipient?->name,
            'handle' => $invitation->recipient?->publicHandle(),
            'inviter' => $invitation->inviter?->name,
            'created_at' => $invitation->created_at?->toIso8601String(),
            'responded_at' => $invitation->responded_at?->toIso8601String(),
        ];
    }

    private function invitations(Workspace $workspace, ?Project $project = null)
    {
        return WorkspaceInvitation::visible()->with(['workspace', 'project', 'recipient', 'inviter'])
            ->where('workspace_id', $workspace->id)
            ->where('project_id', $project?->id)
            ->orderByDesc('id')->get()->map(fn ($item) => $this->present($item))->values();
    }

    public function index(Request $request, Workspace $workspace)
    {
        abort_unless($this->isOwner($request->user(), $workspace), 403);

        $members = $workspace->memberships()->with('user')->get()
            ->filter(fn ($item) => $item->user)
            ->map(fn ($item) => [
                'id' => $item->user->id,
                'name' => $item->user->name,
                'handle' => $item->user->publicHandle(),
                'avatar_url' => $item->user->avatarUrl(),
                'role' => $item->role,
            ])->values();

        return response()->json([
            'members' => $members,
            'invitations' => $this->invitations($workspace),
            'member_limit' => WorkspaceLimits::maxMembers($workspace),
            'member_count' => $workspace->memberships()->count(),
        ]);
    }

    public function projectIndex(Request $request, Project $project)
    {
        abort_unless(ProjectAccess::canManage($request->user(), $project), 403);
        return response()->json(['invitations' => $this->invitations($project->workspace, $project)]);
    }

    public function received(Request $request)
    {
        return WorkspaceInvitation::visible()->where('recipient_user_id', $request->user()->id)
            ->with(['workspace', 'project', 'recipient', 'inviter'])->orderByDesc('id')->get()
            ->map(fn ($item) => $this->present($item))->values();
    }

    private function resolve(string $value): ?User
    {
        $value = trim($value);
        if (filter_var($value, FILTER_VALIDATE_EMAIL)) {
            return User::whereRaw('LOWER(email) = ?', [Str::lower($value)])->first();
        }
        if (! preg_match('/^@?([a-z0-9_-]{1,30})#([1-9][0-9]*)$/i', $value, $match)) return null;
        $user = User::find((int) $match[2]);
        return $user && Str::lower($user->publicHandle()) === Str::lower(ltrim($value, '@')) ? $user : null;
    }

    private function storeInvites(Request $request, Workspace $workspace, ?Project $project)
    {
        $owner = $this->isOwner($request->user(), $workspace);
        abort_unless($owner || ($project && ProjectAccess::canManage($request->user(), $project)), 403);

        $data = $request->validate([
            'recipients' => ['required', 'array', 'min:1', 'max:50'],
            'recipients.*' => ['required', 'string', 'max:255'],
            'role' => [$project ? 'required' : 'nullable', 'in:responsable,editor,lector'],
        ]);
        $role = $project ? $data['role'] : null;
        $created = [];
        $errors = [];
        $seen = [];
        foreach ($data['recipients'] as $value) {
            $user = $this->resolve($value);
            if (! $user) { $errors[] = ['value' => $value, 'reason' => 'Usuario no encontrado']; continue; }
            if (isset($seen[$user->id])) continue;
            $seen[$user->id] = true;
            if ($user->client_company_id !== null) {
                $errors[] = ['value' => $value, 'reason' => 'Las cuentas de cliente requieren otro tipo de acceso'];
                continue;
            }

            // Responsible users may invite only people already in the Workspace.
            if ($project && ! $owner && ! $workspace->memberships()->where('user_id', $user->id)->exists()) {
                $errors[] = ['value' => $value, 'reason' => 'Solo el propietario puede incorporar usuarios nuevos al Workspace'];
                continue;
            }
            $result = DB::transaction(function () use ($workspace, $project, $role, $user, $request) {
                Workspace::whereKey($workspace->id)->lockForUpdate()->firstOrFail();
                $inWorkspace = $workspace->memberships()->where('user_id', $user->id)->exists();
                if ($project) {
                    if ($project->members()->where('user_id', $user->id)->exists() || (int) $workspace->owner_id === (int) $user->id)
                        return 'Ya pertenece al proyecto';
                } elseif ($inWorkspace) return 'Ya pertenece al Workspace';

                $pending = WorkspaceInvitation::where('workspace_id', $workspace->id)
                    ->where('project_id', $project?->id)->where('recipient_user_id', $user->id)
                    ->where('status', 'pending')->whereNull('revoked_at')->exists();
                if ($pending) return 'Ya tiene una invitación pendiente';
                if (! $inWorkspace && ! WorkspaceLimits::canAddMember($workspace))
                    return 'No quedan plazas libres en el Workspace';

                $invitation = WorkspaceInvitation::create([
                    'workspace_id' => $workspace->id,
                    'project_id' => $project?->id,
                    'recipient_user_id' => $user->id,
                    'invited_by' => $request->user()->id,
                    'email' => null,
                    'token_hash' => hash('sha256', Str::random(64)),
                    'max_uses' => 1,
                    'used_count' => 0,
                    'expires_at' => now()->addYears(50),
                    'status' => 'pending',
                    'project_role' => $role,
                ]);
                if ($user->notify_in_app) {
                    AppNotification::create([
                        'user_id' => $user->id,
                        'body' => 'Tienes una invitación a '.($project ? '«'.$project->name.'»' : '«'.$workspace->name.'»').' en Tickard.',
                    ]);
                }
                return $this->present($invitation->load(['workspace', 'project', 'recipient', 'inviter']));
            });
            if (is_string($result)) $errors[] = ['value' => $value, 'reason' => $result];
            else $created[] = $result;
        }
        return response()->json(['created' => $created, 'errors' => $errors], count($created) ? 201 : 422);
    }

    public function store(Request $request, Workspace $workspace)
    {
        return $this->storeInvites($request, $workspace, null);
    }

    public function projectStore(Request $request, Project $project)
    {
        return $this->storeInvites($request, $project->workspace, $project);
    }

    public function respond(Request $request, WorkspaceInvitation $invitation)
    {
        $action = $request->validate(['action' => ['required', 'in:accept,reject']])['action'];
        abort_unless((int) $invitation->recipient_user_id === (int) $request->user()->id, 403);

        return DB::transaction(function () use ($invitation, $request, $action) {
            $workspace = Workspace::whereKey($invitation->workspace_id)->lockForUpdate()->firstOrFail();
            $invitation = WorkspaceInvitation::whereKey($invitation->id)->lockForUpdate()->firstOrFail();
            abort_unless($invitation->status === 'pending' && ! $invitation->revoked_at, 409,
                'Esta invitación ya se ha respondido o cancelado.');
            if ($action === 'accept') {
                $hasWorkspace = $workspace->memberships()->where('user_id', $request->user()->id)->exists();
                if (! $hasWorkspace) {
                    abort_unless(WorkspaceLimits::canAddMember($workspace), 422,
                        'El Workspace ha alcanzado el límite de miembros.');
                    $workspace->memberships()->create(['user_id' => $request->user()->id, 'role' => 'member']);
                }
                if ($invitation->project_id) {
                    $project = $workspace->projects()->findOrFail($invitation->project_id);
                    ProjectMember::firstOrCreate(
                        ['project_id' => $project->id, 'user_id' => $request->user()->id],
                        ['role' => $invitation->project_role]
                    );
                }
            }
            $invitation->update(['status' => $action === 'accept' ? 'accepted' : 'rejected',
                'responded_at' => now(), 'used_count' => $action === 'accept' ? 1 : 0]);
            return response()->json(['status' => $invitation->status, 'workspace_id' => $workspace->id]);
        });
    }

    private function deleteInvites(Request $request, Workspace $workspace, ?Project $project)
    {
        abort_unless($this->isOwner($request->user(), $workspace)
            || ($project && ProjectAccess::canManage($request->user(), $project)), 403);
        $ids = $request->validate(['ids' => ['required', 'array', 'min:1', 'max:100'],
            'ids.*' => ['required', 'integer', 'distinct']])['ids'];
        // Only pending/rejected invitations can be deleted manually.
        $query = WorkspaceInvitation::where('workspace_id', $workspace->id)
            ->where('project_id', $project?->id)->whereIn('id', $ids)
            ->whereIn('status', ['pending', 'rejected'])->whereNotNull('recipient_user_id');
        $deleted = $query->count();
        abort_unless($deleted === count($ids), 422, 'La selección incluye invitaciones no eliminables.');
        $query->delete();
        return response()->json(['deleted' => $deleted]);
    }

    public function deleteMany(Request $request, Workspace $workspace)
    {
        return $this->deleteInvites($request, $workspace, null);
    }

    public function projectDeleteMany(Request $request, Project $project)
    {
        return $this->deleteInvites($request, $project->workspace, $project);
    }

    // Old shared links have been retired from V1.
    public function show(string $token) { abort(410, 'Este tipo de invitación ya no está disponible.'); }
    public function accept(Request $request, string $token) { abort(410, 'Este tipo de invitación ya no está disponible.'); }
}
