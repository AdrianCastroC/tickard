<?php

namespace App\Http\Controllers\Api;

use App\Models\AppNotification;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Models\WorkspaceCustomRole;
use App\Support\ProjectAccess;
use App\Support\RoleAvailability;
use App\Support\WorkspaceLimits;
use App\Support\WorkspaceClientAccess;
use App\Models\ClientCompany;
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
            'custom_role_id' => $invitation->custom_role_id,
            'custom_role_name' => $invitation->customRole?->name,
            'kind' => $invitation->client_company_name ? 'client_company' : 'workspace',
            'client_company_name' => $invitation->client_company_name,
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
        return WorkspaceInvitation::visible()->with(['workspace', 'project', 'recipient', 'inviter', 'customRole'])
            ->where('workspace_id', $workspace->id)
            ->where('project_id', $project?->id)->whereNull('client_company_name')
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
        abort_unless(ProjectAccess::canManageMembers($request->user(), $project), 403);

        $project->load('workspace.owner');
        $owner = $project->workspace->owner;
        $members = $project->members()->with('user')->get()
            ->filter(fn (ProjectMember $membership) => $membership->user !== null)
            ->map(function (ProjectMember $membership) use ($owner) {
                $user = $membership->user;
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'handle' => $user->publicHandle(),
                    'avatar_url' => $user->avatarUrl(),
                    'role' => $owner && $user->id === $owner->id
                        ? 'responsable' : $membership->role,
                ];
            });

        // The Workspace owner has effective responsible permissions even
        // without an explicit project_members record.
        if ($owner && ! $members->contains('id', $owner->id)) {
            $members->push([
                'id' => $owner->id,
                'name' => $owner->name,
                'handle' => $owner->publicHandle(),
                'avatar_url' => $owner->avatarUrl(),
                'role' => 'responsable',
            ]);
        }

        $members = $members->sortBy(fn ($member) => [
            $member['role'] === 'responsable' ? 0 : 1,
            mb_strtolower($member['name']),
            $member['id'],
        ])->values();

        return response()->json([
            'members' => $members,
            'member_count' => $members->count(),
            'invitations' => $this->invitations($project->workspace, $project),
        ]);
    }

    public function received(Request $request)
    {
        return WorkspaceInvitation::visible()->where('recipient_user_id', $request->user()->id)
            ->with(['workspace', 'project', 'recipient', 'inviter', 'customRole'])->orderByDesc('id')->get()
            ->map(fn ($item) => $this->present($item))->values();
    }

    private function resolve(string $value): ?User
    {
        $value = trim($value);
        if (filter_var($value, FILTER_VALIDATE_EMAIL)) {
            return User::whereRaw('LOWER(email) = ?', [Str::lower($value)])->first();
        }
        // Resolve the stored immutable identifier instead of deriving the
        // prefix from the user's current first name.
        if (! preg_match('/^@?([a-z0-9_-]{1,30})#([0-9]{5,})$/i', $value)) return null;
        return User::whereRaw('LOWER(public_handle) = ?', [Str::lower(ltrim($value, '@'))])->first();
    }

    private function storeInvites(Request $request, Workspace $workspace, ?Project $project)
    {
        $owner = $this->isOwner($request->user(), $workspace);
        abort_unless($owner || ($project && ProjectAccess::canManageMembers($request->user(), $project)), 403);

        $data = $request->validate([
            'recipients' => ['required', 'array', 'min:1', 'max:50'],
            'recipients.*' => ['required', 'string', 'max:255'],
            'role' => [$project ? 'required' : 'nullable', 'in:responsable,editor,lector'],
            'custom_role_id' => ['nullable', 'integer'],
        ]);
        $role = $project ? $data['role'] : null;
        $customRole = null;
        if (! empty($data['custom_role_id'])) {
            $customRole = WorkspaceCustomRole::where('workspace_id', $workspace->id)
                ->whereIn('scope', [$project ? 'project' : 'workspace', 'both'])
                ->findOrFail($data['custom_role_id']);
            abort_unless(RoleAvailability::custom($customRole, $workspace, $project ? 'project' : 'workspace'), 422, 'El rol está desactivado.');
            abort_if($project && $role !== 'lector', 422,
                'Un rol personalizado no puede heredar privilegios del rol base.');
        }
        if ($project && ! $customRole) abort_unless(RoleAvailability::builtin($workspace, $role), 422, 'El rol está desactivado.');
        if (! $project && ! $customRole) abort_unless(RoleAvailability::builtin($workspace, 'member'), 422, 'El rol Miembro está desactivado.');
        $created = [];
        $errors = [];
        $seen = [];
        foreach ($data['recipients'] as $value) {
            $user = $this->resolve($value);
            if (! $user) { $errors[] = ['value' => $value, 'reason' => 'Usuario no encontrado']; continue; }
            if (isset($seen[$user->id])) continue;
            $seen[$user->id] = true;
            if (WorkspaceClientAccess::isClient($user, $workspace)) {
                $errors[] = ['value' => $value, 'reason' => 'Las cuentas de cliente requieren otro tipo de acceso'];
                continue;
            }

            // Responsible users may invite only people already in the Workspace.
            if ($project && ! $owner && ! $workspace->memberships()->where('user_id', $user->id)->exists()) {
                $errors[] = ['value' => $value, 'reason' => 'Solo el propietario puede incorporar usuarios nuevos al Workspace'];
                continue;
            }
            $result = DB::transaction(function () use ($workspace, $project, $role, $customRole, $user, $request) {
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
                    'custom_role_id' => $customRole?->id,
                ]);
                if ($user->notify_in_app) {
                    AppNotification::create([
                        'user_id' => $user->id,
                        'body' => 'Tienes una invitación a '.($project ? '«'.$project->name.'»' : '«'.$workspace->name.'»').' en Tickard.',
                        'kind' => 'invitation',
                    ]);
                }
                return $this->present($invitation->load(['workspace', 'project', 'recipient', 'inviter', 'customRole']));
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
            if ($invitation->client_company_name !== null) {
                $name = trim($invitation->client_company_name);
                abort_unless($workspace->show_clients, 422, 'Este Workspace ya no admite clientes.');
                abort_if($invitation->expires_at?->isPast(), 409, 'La invitación ha caducado.');
                if ($action === 'accept') {
                    abort_unless($request->user()->email_verified_at !== null, 422,
                        'Verifica tu correo antes de aceptar la invitación.');
                    abort_unless(! $workspace->memberships()
                        ->where('user_id', $request->user()->id)->exists(), 422,
                        'Ya perteneces al Workspace. Una cuenta interna no puede convertirse automáticamente en cliente.');
                    abort_unless(WorkspaceLimits::canAddMember($workspace), 422,
                        'El Workspace no tiene plazas disponibles.');
                    abort_unless(! ClientCompany::where('workspace_id', $workspace->id)
                        ->where('name', $name)->exists(), 422,
                        'Ya existe una empresa con este nombre.');
                    $company = ClientCompany::create([
                        'workspace_id' => $workspace->id,
                        'name' => $name, 'client_type' => $invitation->client_type ?? 'company',
                        'sector' => $invitation->client_sector,
                        'description' => $invitation->client_description,
                        'status' => 'active',
                        'primary_contact_user_id' => $request->user()->id,
                    ]);
                    $workspace->memberships()->create([
                        'user_id' => $request->user()->id,
                        'role' => 'client', 'client_company_id' => $company->id,
                    ]);
                }
                $invitation->update([
                    'status' => $action === 'accept' ? 'accepted' : 'rejected',
                    'responded_at' => now(), 'used_count' => $action === 'accept' ? 1 : 0,
                ]);
                return response()->json([
                    'status' => $invitation->status, 'workspace_id' => $workspace->id,
                    'client_company_id' => $company->id ?? null,
                ]);
            }
            if ($action === 'accept') {
                $customRole = $invitation->customRole;
                if ($invitation->custom_role_id !== null) {
                    abort_unless($customRole && (int) $customRole->workspace_id === (int) $workspace->id
                        && in_array($customRole->scope, [$invitation->project_id ? 'project' : 'workspace', 'both'], true), 409,
                        'El rol de esta invitación ya no es válido. Solicita una nueva invitación.');
                }
                if ($customRole) abort_unless(RoleAvailability::custom($customRole, $workspace,
                    $invitation->project_id ? 'project' : 'workspace'), 409, 'El rol está desactivado.');
                elseif ($invitation->project_id) abort_unless(RoleAvailability::builtin($workspace, $invitation->project_role), 409, 'El rol está desactivado.');
                $hasWorkspace = $workspace->memberships()->where('user_id', $request->user()->id)->exists();
                if (! $hasWorkspace) {
                    abort_unless(WorkspaceLimits::canAddMember($workspace), 422,
                        'El Workspace ha alcanzado el límite de miembros.');
                    $workspace->memberships()->create(['user_id' => $request->user()->id, 'role' => 'member',
                        'custom_role_id' => $invitation->project_id ? null : $customRole?->id]);
                }
                if ($invitation->project_id) {
                    $project = $workspace->projects()->findOrFail($invitation->project_id);
                    ProjectMember::firstOrCreate(
                        ['project_id' => $project->id, 'user_id' => $request->user()->id],
                        ['role' => $invitation->project_role,
                            'custom_role_id' => $customRole?->id]
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
            || ($project && ProjectAccess::canManageMembers($request->user(), $project)), 403);
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
