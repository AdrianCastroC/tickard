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
            ->select('link.user_id', 'entity.id', 'entity.name', 'entity.lead_user_id')->get()->groupBy('user_id');
        $teams = DB::table('team_user as link')
            ->join('teams as entity', 'entity.id', '=', 'link.team_id')
            ->where('entity.workspace_id', $workspace->id)
            ->whereIn('link.user_id', $ids)
            ->select('link.user_id', 'entity.id', 'entity.name', 'entity.lead_user_id')->get()->groupBy('user_id');
        $projects = DB::table('project_members as link')
            ->join('projects as entity', 'entity.id', '=', 'link.project_id')
            ->where('entity.workspace_id', $workspace->id)
            ->whereIn('link.user_id', $ids)
            ->select('link.user_id', 'entity.id', 'entity.name', 'link.role')->get()->groupBy('user_id');

        $members = $memberships->map(function ($membership) use ($workspace, $departments, $teams, $projects) {
            $user = $membership->user;
            $isClient = WorkspaceClientAccess::isClient($user, $workspace);
            return [
                'id' => $user->id,
                'name' => $user->name,
                'handle' => $user->publicHandle(),
                'avatar_url' => $user->avatarUrl(),
                'email' => $user->email,
                'professional_phone' => $user->professional_phone,
                'job_title' => $membership->job_title,
                'joined_at' => $membership->created_at?->toDateString(),
                'role' => (int) $workspace->owner_id === (int) $user->id ? 'owner' : ($isClient ? 'client' : $membership->role),
                'custom_role_id' => $isClient ? null : $membership->custom_role_id,
                'custom_role_name' => $isClient ? null : $membership->customRole?->name,
                'is_client' => $isClient,
                'departments' => ($departments->get($user->id) ?? collect())->map(fn ($x) => ['id' => $x->id, 'name' => $x->name, 'is_lead' => (int) $x->lead_user_id === (int) $user->id])->values(),
                'teams' => ($teams->get($user->id) ?? collect())->map(fn ($x) => ['id' => $x->id, 'name' => $x->name, 'is_lead' => (int) $x->lead_user_id === (int) $user->id])->values(),
                'projects' => ($projects->get($user->id) ?? collect())->map(fn ($x) => ['id' => $x->id, 'name' => $x->name, 'role' => $x->role])->values(),
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
            'can_remove_members' => $isOwner,
            'can_manage_jobs' => $isOwner || $workspace->memberships()->where('user_id', $request->user()->id)->where('role', 'admin')->exists(),
        ]);
    }

    public function updateJobTitle(Request $request, Workspace $workspace, User $user)
    {
        $this->authorizeViewer($request, $workspace);
        $data = $request->validate([
            'job_title' => ['nullable', 'string', 'max:120'],
        ]);
        $title = trim($data['job_title'] ?? '');
        abort_if(mb_strlen($title) > 120, 422, 'El cargo no puede superar los 120 caracteres.');

        DB::transaction(function () use ($workspace, $user, $title) {
            $membership = $workspace->memberships()
                ->where('user_id', $user->id)->lockForUpdate()->firstOrFail();
            abort_if(WorkspaceClientAccess::isClient($user, $workspace), 422,
                'El cargo de las cuentas de cliente no puede modificarse desde Personal.');
            $membership->update(['job_title' => $title !== '' ? $title : null]);
        });

        return response()->json(['user_id' => $user->id, 'job_title' => $title !== '' ? $title : null]);
    }

    public function updateRole(Request $request, Workspace $workspace, User $user)
    {
        abort_unless((int) $workspace->owner_id === (int) $request->user()->id, 403);
        $data = $request->validate([
            'role' => ['required', Rule::in(['member', 'admin'])],
            'custom_role_id' => ['nullable', 'integer', Rule::exists('workspace_custom_roles', 'id')
                ->where('workspace_id', $workspace->id)->where('scope', 'workspace')],
        ]);
        abort_if(! empty($data['custom_role_id']) && $data['role'] !== 'member', 422,
            'Los roles personalizados no pueden heredar permisos de administrador.');
        abort_if((int) $user->id === (int) $workspace->owner_id, 422,
            'No puedes modificar el rol del propietario del Workspace.');

        DB::transaction(function () use ($workspace, $user, $data) {
            $member = $workspace->memberships()->where('user_id', $user->id)->lockForUpdate()->firstOrFail();
            abort_if($member->role === 'owner' || WorkspaceClientAccess::isClient($user, $workspace), 422,
                'El rol de una cuenta de cliente no puede modificarse desde Personal.');
            $member->update(['role' => $data['role'], 'custom_role_id' => $data['custom_role_id'] ?? null]);
        });

        return response()->json(['user_id' => $user->id, 'role' => $data['role'], 'custom_role_id' => $data['custom_role_id'] ?? null]);
    }
    /**
     * Revoke access to this Workspace without deleting the global user or
     * historical Card content, comments, activities and checklists.
     *
     * All revocations are scoped through entities owned by this Workspace,
     * so memberships and assignments in other Workspaces remain untouched.
     */
    public function destroy(Request $request, Workspace $workspace, User $user)
    {
        abort_unless((int) $workspace->owner_id === (int) $request->user()->id, 403);
        abort_if((int) $user->id === (int) $workspace->owner_id, 422,
            'No puedes dar de baja al propietario del Workspace.');

        DB::transaction(function () use ($workspace, $user) {
            $membership = $workspace->memberships()
                ->where('user_id', $user->id)->lockForUpdate()->firstOrFail();

            abort_if($membership->role === 'owner', 422,
                'El propietario del Workspace no puede darse de baja.');
            abort_if(WorkspaceClientAccess::isClient($user, $workspace) || $membership->role === 'client', 422,
                'Los usuarios de empresas cliente se gestionan desde Clientes.');

            $projectIds = DB::table('projects')->select('id')
                ->where('workspace_id', $workspace->id);
            $departmentIds = DB::table('departments')->select('id')
                ->where('workspace_id', $workspace->id);
            $teamIds = DB::table('teams')->select('id')
                ->where('workspace_id', $workspace->id);

            // Remember affected boards before detaching assignments: their
            // revision must advance so Kanban/Gantt caches refresh correctly.
            $affectedBoardIds = DB::table('card_user as link')
                ->join('cards', 'cards.id', '=', 'link.card_id')
                ->join('boards', 'boards.id', '=', 'cards.board_id')
                ->join('projects', 'projects.id', '=', 'boards.project_id')
                ->where('projects.workspace_id', $workspace->id)
                ->where('link.user_id', $user->id)
                ->distinct()->pluck('boards.id')->all();
            $checklistBoardIds = DB::table('card_checklist_item_user as link')
                ->join('card_checklist_items as item', 'item.id', '=', 'link.card_checklist_item_id')
                ->join('cards', 'cards.id', '=', 'item.card_id')
                ->join('boards', 'boards.id', '=', 'cards.board_id')
                ->join('projects', 'projects.id', '=', 'boards.project_id')
                ->where('projects.workspace_id', $workspace->id)
                ->where('link.user_id', $user->id)
                ->distinct()->pluck('boards.id')->all();
            $affectedBoardIds = array_values(array_unique(array_merge($affectedBoardIds, $checklistBoardIds)));

            // Unassign Tasks and checklist items, including completed Cards,
            // without removing Cards or their historical activity and comments.
            DB::table('card_user')->where('user_id', $user->id)
                ->whereIn('card_id', function ($query) use ($workspace) {
                    $query->select('cards.id')->from('cards')
                        ->join('boards', 'boards.id', '=', 'cards.board_id')
                        ->join('projects', 'projects.id', '=', 'boards.project_id')
                        ->where('projects.workspace_id', $workspace->id);
                })->delete();

            DB::table('card_checklist_item_user')->where('user_id', $user->id)
                ->whereIn('card_checklist_item_id', function ($query) use ($workspace) {
                    $query->select('card_checklist_items.id')->from('card_checklist_items')
                        ->join('cards', 'cards.id', '=', 'card_checklist_items.card_id')
                        ->join('boards', 'boards.id', '=', 'cards.board_id')
                        ->join('projects', 'projects.id', '=', 'boards.project_id')
                        ->where('projects.workspace_id', $workspace->id);
                })->delete();

            if ($affectedBoardIds) {
                DB::table('boards')->whereIn('id', $affectedBoardIds)->increment('revision');
            }

            DB::table('project_members')->where('user_id', $user->id)
                ->whereIn('project_id', $projectIds)->delete();

            // A removed member cannot remain responsible for a group.
            // Null is allowed by the schema; the Owner may choose a new lead.
            DB::table('departments')->where('workspace_id', $workspace->id)
                ->where('lead_user_id', $user->id)->update(['lead_user_id' => null]);
            DB::table('teams')->where('workspace_id', $workspace->id)
                ->where('lead_user_id', $user->id)->update(['lead_user_id' => null]);

            DB::table('department_user')->where('user_id', $user->id)
                ->whereIn('department_id', $departmentIds)->delete();
            DB::table('team_user')->where('user_id', $user->id)
                ->whereIn('team_id', $teamIds)->delete();

            // Pending workspace and project invitations must not let a
            // removed member silently rejoin after access has been revoked.
            DB::table('workspace_invitations')
                ->where('workspace_id', $workspace->id)
                ->where('recipient_user_id', $user->id)
                ->where('status', 'pending')
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now(), 'updated_at' => now()]);

            // Remove Workspace membership last so no partial access remains.
            $membership->delete();
        });

        return response()->noContent();
    }

}
