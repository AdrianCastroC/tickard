<?php

namespace App\Http\Controllers\Api;

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceInvitation;
use App\Support\WorkspaceClientAccess;
use App\Support\WorkspaceLimits;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class WorkspaceMembersController extends ApiController
{
    private function authorizeViewer(Request $request, Workspace $workspace): bool
    {
        $membership = $workspace->memberships()->where('user_id', $request->user()->id)->first();
        abort_unless($membership, 403);

        $owner = (int) $workspace->owner_id === (int) $request->user()->id;
        abort_unless($owner || $membership->role === 'admin' || (bool) $request->user()->is_admin, 403);

        return $owner;
    }

    public function index(Request $request, Workspace $workspace)
    {
        $isOwner = $this->authorizeViewer($request, $workspace);
        $memberships = $workspace->memberships()->with('user')->get()->filter(fn ($m) => $m->user !== null);
        $ids = $memberships->pluck('user_id')->all();

        $departments = DB::table('department_user as link')
            ->join('departments as entity', 'entity.id', '=', 'link.department_id')
            ->where('entity.workspace_id', $workspace->id)
            ->whereIn('link.user_id', $ids)
            ->select('link.user_id', 'entity.id', 'entity.name')->get()->groupBy('user_id');
        $teams = DB::table('team_user as link')
            ->join('teams as entity', 'entity.id', '=', 'link.team_id')
            ->where('entity.workspace_id', $workspace->id)
            ->whereIn('link.user_id', $ids)
            ->select('link.user_id', 'entity.id', 'entity.name')->get()->groupBy('user_id');
        $projects = DB::table('project_members as link')
            ->join('projects as entity', 'entity.id', '=', 'link.project_id')
            ->where('entity.workspace_id', $workspace->id)
            ->whereIn('link.user_id', $ids)
            ->select('link.user_id', 'entity.id', 'entity.name')->get()->groupBy('user_id');

        $members = $memberships->map(function ($membership) use ($workspace, $departments, $teams, $projects) {
            $user = $membership->user;
            $isClient = WorkspaceClientAccess::isClient($user, $workspace);
            return [
                'id' => $user->id,
                'name' => $user->name,
                'handle' => $user->publicHandle(),
                'avatar_url' => $user->avatarUrl(),
                'role' => (int) $workspace->owner_id === (int) $user->id ? 'owner' : ($isClient ? 'client' : $membership->role),
                'is_client' => $isClient,
                'departments' => ($departments->get($user->id) ?? collect())->map(fn ($x) => ['id' => $x->id, 'name' => $x->name])->values(),
                'teams' => ($teams->get($user->id) ?? collect())->map(fn ($x) => ['id' => $x->id, 'name' => $x->name])->values(),
                'projects' => ($projects->get($user->id) ?? collect())->map(fn ($x) => ['id' => $x->id, 'name' => $x->name])->values(),
            ];
        })->sortBy(fn ($m) => [
            $m['role'] === 'owner' ? 0 : ($m['role'] === 'admin' ? 1 : 2),
            mb_strtolower($m['name']), $m['id'],
        ])->values();

        $pending = $isOwner ? WorkspaceInvitation::visible()
            ->where('workspace_id', $workspace->id)->whereNull('project_id')
            ->whereNull('client_company_name')->where('status', 'pending')->count() : 0;

        return response()->json([
            'members' => $members,
            'member_count' => $memberships->count(),
            'member_limit' => WorkspaceLimits::maxMembers($workspace),
            'pending_invitations' => $pending,
            'can_manage_roles' => $isOwner,
        ]);
    }

    public function updateRole(Request $request, Workspace $workspace, User $user)
    {
        abort_unless((int) $workspace->owner_id === (int) $request->user()->id, 403);
        $data = $request->validate(['role' => ['required', Rule::in(['member', 'admin'])]]);
        abort_if((int) $user->id === (int) $workspace->owner_id, 422,
            'No puedes modificar el rol del propietario del Workspace.');

        DB::transaction(function () use ($workspace, $user, $data) {
            $member = $workspace->memberships()->where('user_id', $user->id)->lockForUpdate()->firstOrFail();
            abort_if($member->role === 'owner' || WorkspaceClientAccess::isClient($user, $workspace), 422,
                'El rol de una cuenta de cliente no puede modificarse desde Personal.');
            $member->update(['role' => $data['role']]);
        });

        return response()->json(['user_id' => $user->id, 'role' => $data['role']]);
    }
}
