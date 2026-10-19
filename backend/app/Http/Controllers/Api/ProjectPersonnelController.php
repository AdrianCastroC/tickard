<?php

namespace App\Http\Controllers\Api;

use App\Models\Card;
use App\Models\Department;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Team;
use App\Models\User;
use App\Support\ProjectAccess;
use App\Support\WorkspaceClientAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ProjectPersonnelController extends ApiController
{
    private const ROLES = ['responsable', 'editor', 'lector', 'cliente'];

    public function index(Request $request, Project $project)
    {
        $role = ProjectAccess::role($request->user(), $project);
        abort_unless($role !== null, 403);
        $client = $role === 'cliente';
        $canManage = ProjectAccess::canManageMembers($request->user(), $project);

        $memberships = $project->members()->with('user')->get()
            ->filter(fn (ProjectMember $member) => $member->user !== null)
            ->when($client, fn ($items) => $items->filter(
                fn (ProjectMember $member) => $member->user_id === $request->user()->id
            ))->values();
        $teams = $client ? collect() : Team::query()
            ->where('workspace_id', $project->workspace_id)
            ->with('members:id,name')
            ->orderBy('name')->get();
        $departments = $client ? collect() : Department::query()
            ->where('workspace_id', $project->workspace_id)
            ->with('members:id,name')
            ->orderBy('name')->get();

        // All task data remains within the project. Clients only get their
        // own public assignments, never aggregate internal project statistics.
        $assignments = DB::table('cards')
            ->join('boards', 'boards.id', '=', 'cards.board_id')
            ->join('columns', 'columns.id', '=', 'cards.column_id')
            ->leftJoin('card_user', 'card_user.card_id', '=', 'cards.id')
            ->where('boards.project_id', $project->id)
            ->whereNull('cards.archived_at')
            ->when($client, fn ($query) => $query
                ->where('cards.is_internal', false)
                ->where('card_user.user_id', $request->user()->id))
            ->select([
                'cards.id', 'cards.title', 'cards.due_date', 'cards.updated_at', 'cards.is_milestone',
                'boards.id as board_id', 'boards.name as board_name',
                'columns.id as column_id', 'columns.name as column_name',
                'columns.workflow_state', 'card_user.user_id',
            ])->get();

        $today = now()->toDateString();
        $tasks = $assignments->unique('id')->values();

        // Keep the configured column names and positions from the real boards.
        // Backlog columns are listed first, then the remaining columns in
        // board/column order. Clients only learn about their own public Cards.
        $columns = DB::table('columns')
            ->join('boards', 'boards.id', '=', 'columns.board_id')
            ->where('boards.project_id', $project->id)
            ->when($client, fn ($query) => $query->whereIn(
                'columns.id', $tasks->pluck('column_id')->unique()->all()
            ))
            ->orderByRaw("CASE WHEN columns.workflow_state = 'backlog' THEN 0 ELSE 1 END")
            ->orderBy('boards.position')
            ->orderBy('boards.id')
            ->orderBy('columns.position')
            ->orderBy('columns.id')
            ->get([
                'columns.id', 'columns.name', 'columns.color',
                'columns.workflow_state', 'columns.position',
                'boards.id as board_id', 'boards.name as board_name',
            ]);

        // Group assignments once instead of rescanning them for every user.
        $assignedByUser = $assignments->filter(fn ($row) => $row->user_id !== null)->groupBy('user_id');
        $countStates = function ($items) use ($today) {
            return [
                'total' => $items->count(),
                'backlog' => $items->where('workflow_state', 'backlog')->count(),
                'pending' => $items->where('workflow_state', 'pending')->count(),
                'in_progress' => $items->where('workflow_state', 'in_progress')->count(),
                'review' => $items->where('workflow_state', 'review')->count(),
                'done' => $items->where('workflow_state', 'done')->count(),
                'overdue' => $items->filter(fn ($row) =>
                    $row->due_date !== null && $row->due_date < $today
                    && ! in_array($row->workflow_state, ['done', 'backlog'], true)
                )->count(),
            ];
        };

        // Reuse the Workspace-specific job title: it is not a project role or global profile field.
        $jobTitles = DB::table('workspace_members')
            ->where('workspace_id', $project->workspace_id)
            ->whereIn('user_id', $memberships->pluck('user_id')->all())
            ->pluck('job_title', 'user_id');

        $people = $memberships->map(function (ProjectMember $membership) use (
            $assignedByUser, $teams, $departments, $countStates, $today, $client, $project, $jobTitles
        ) {
            $user = $membership->user;
            $assigned = ($assignedByUser->get($user->id) ?? collect())->unique('id')->values();
            $ordered = $assigned->sortBy(fn ($row) => [
                $row->due_date === null ? 1 : 0,
                $row->due_date ?? '9999-12-31',
                $row->id,
            ]);
            return [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $client ? null : $user->email,
                'job_title' => $client ? null : $jobTitles->get($user->id),
                'avatar_url' => $user->avatarUrl(),
                'custom_role_id' => $membership->custom_role_id,
                'custom_role_name' => $membership->customRole?->name,
                'role' => (int) $project->workspace->owner_id === (int) $user->id ? 'responsable' : $membership->role,
                'is_workspace_owner' => (int) $project->workspace->owner_id === (int) $user->id,
                'teams' => $client ? [] : $teams->filter(fn ($team) =>
                    $team->members->contains('id', $user->id)
                )->map(fn ($team) => ['id' => $team->id, 'name' => $team->name])->values(),
                'departments' => $client ? [] : $departments->filter(fn ($department) =>
                    $department->members->contains('id', $user->id)
                )->map(fn ($department) => ['id' => $department->id, 'name' => $department->name])->values(),
                'stats' => $countStates($assigned),
                'column_counts' => $assigned->groupBy('column_id')->map(fn ($group) => $group->count()),
                'tasks' => $ordered->map(fn ($row) => [
                    'id' => $row->id,
                    'title' => $row->title,
                    'board_id' => $row->board_id,
                    'board_name' => $row->board_name,
                    'column_id' => $row->column_id,
                    'column_name' => $row->column_name,
                    'due_date' => $row->due_date,
                    'updated_at' => $row->updated_at,
                    'workflow_state' => $row->workflow_state,
                    'is_milestone' => (bool) $row->is_milestone,
                    'overdue' => $row->due_date !== null && $row->due_date < $today
                        && ! in_array($row->workflow_state, ['done', 'backlog'], true),
                ])->values(),
            ];
        })->values();

        $projectTeamIds = DB::table('project_team')
            ->where('project_id', $project->id)->pluck('team_id')
            ->map(fn ($id) => (int) $id)->all();
        $workspaceMemberIds = $canManage
            ? $project->workspace->members()->get()
                ->reject(fn ($member) => WorkspaceClientAccess::isClient($member, $project->workspace))
                ->pluck('id')->all()
            : [];

        return response()->json([
            'members' => $people,
            'columns' => $columns,
            'summary' => array_merge($countStates($tasks), [
                'assigned' => $tasks->filter(fn ($row) => $row->user_id !== null)->count(),
                'members' => $people->count(),
            ]),
            'can_manage' => $canManage,
            'teams' => $client ? [] : $teams->map(fn ($team) => [
                'id' => $team->id,
                'name' => $team->name,
                'linked' => in_array($team->id, $projectTeamIds, true),
                'members' => $canManage ? $team->members
                    ->filter(fn ($member) => in_array($member->id, $workspaceMemberIds, true))
                    ->map(fn ($member) => ['id' => $member->id, 'name' => $member->name])->values() : [],
            ])->values(),
            'departments' => $client ? [] : $departments->map(fn ($department) => [
                'id' => $department->id, 'name' => $department->name,
            ])->values(),
            'available_people' => $canManage
                ? $project->workspace->members()
                    ->get(['users.id', 'users.name', 'users.email'])
                    ->reject(fn ($user) => WorkspaceClientAccess::isClient($user, $project->workspace))
                    ->map(fn ($user) => [
                        'id' => $user->id, 'name' => $user->name, 'email' => $user->email,
                    ])->values()
                : [],
        ]);
    }

    public function addMember(Request $request, Project $project)
    {
        $this->authorizeManage($request, $project);
        $data = $request->validate([
            'user_id' => ['required', 'integer', Rule::exists('workspace_members', 'user_id')
                ->where('workspace_id', $project->workspace_id)],
            'role' => ['required', Rule::in(['responsable', 'editor', 'lector'])],
            'custom_role_id' => ['nullable', 'integer', Rule::exists('workspace_custom_roles', 'id')->where('workspace_id', $project->workspace_id)->where('scope', 'project')],
        ]);
        abort_if(! empty($data['custom_role_id']) && $data['role'] !== 'lector', 422,
            'Los roles personalizados se asignan sin privilegios del rol base.');
        $candidate = User::findOrFail($data['user_id']);
        abort_if(WorkspaceClientAccess::isClient($candidate, $project->workspace), 422,
            'Los usuarios cliente requieren acceso específico y no pueden añadirse como internos.');
        $member = ProjectMember::firstOrCreate([
            'project_id' => $project->id,
            'user_id' => $data['user_id'],
        ], ['role' => $data['role'], 'custom_role_id' => $data['custom_role_id'] ?? null]);

        return response()->json([
            'added' => $member->wasRecentlyCreated,
            'role' => $member->role,
            'custom_role_id' => $member->custom_role_id,
        ], $member->wasRecentlyCreated ? 201 : 200);
    }

    public function updateMember(Request $request, Project $project, User $user)
    {
        $this->authorizeManage($request, $project);
        $data = $request->validate([
            'role' => ['required', Rule::in(self::ROLES)],
            'custom_role_id' => ['nullable', 'integer', Rule::exists('workspace_custom_roles', 'id')->where('workspace_id', $project->workspace_id)->where('scope', 'project')],
        ]);
        abort_if(! empty($data['custom_role_id']) && $data['role'] !== 'lector', 422,
            'Los roles personalizados se asignan sin privilegios del rol base.');
        abort_if(ProjectAccess::isWorkspaceOwner($user, $project), 403,
            'El propietario del Workspace no puede perder su rol desde un proyecto.');
        $member = $project->members()->where('user_id', $user->id)->firstOrFail();
        $linkedClient = WorkspaceClientAccess::companyId($user, $project->workspace);
        if ($data['role'] === 'cliente') {
            abort_unless($project->client_access_enabled && $project->workspace->show_clients
                && $linkedClient !== null
                && $linkedClient === (int) $project->client_company_id, 422,
                'Este proyecto no admite acceso de clientes de esa empresa.');
        } elseif ($linkedClient !== null) {
            abort(422, 'Un usuario cliente no puede asumir un rol interno del proyecto.');
        }
        if ($member->role === 'responsable' && $data['role'] !== 'responsable') {
            $this->ensureOtherResponsible($project, $member->id);
        }
        $member->update(['role' => $data['role'], 'custom_role_id' => $data['custom_role_id'] ?? null]);

        return response()->json(['role' => $member->role, 'custom_role_id' => $member->custom_role_id]);
    }

    public function removeMember(Request $request, Project $project, User $user)
    {
        $this->authorizeManage($request, $project);
        abort_if(ProjectAccess::isWorkspaceOwner($user, $project), 403,
            'El propietario del Workspace no puede perder su rol desde un proyecto.');
        $member = $project->members()->where('user_id', $user->id)->firstOrFail();
        if ($member->role === 'responsable') {
            $this->ensureOtherResponsible($project, $member->id);
        }
        DB::transaction(function () use ($project, $user, $member) {
            $member->delete();
            // Removing project access must also clear stale Card assignments.
            DB::table('card_user')->where('user_id', $user->id)->whereIn('card_id',
                Card::query()->whereHas('board', fn ($query) =>
                    $query->where('project_id', $project->id))->select('cards.id')
            )->delete();
            // An individual may also be assigned to checklist items on Cards
            // belonging to this project. Do not leave those stale assignments
            // after project access has been revoked.
            DB::table('card_checklist_item_user')->where('user_id', $user->id)
                ->whereIn('card_checklist_item_id', function ($query) use ($project) {
                    $query->select('card_checklist_items.id')->from('card_checklist_items')
                        ->join('cards', 'cards.id', '=', 'card_checklist_items.card_id')
                        ->join('boards', 'boards.id', '=', 'cards.board_id')
                        ->where('boards.project_id', $project->id);
                })->delete();
            $project->boards()->increment('revision');
        });

        return response()->noContent();
    }

    public function assignTeam(Request $request, Project $project)
    {
        $this->authorizeManage($request, $project);
        $data = $request->validate([
            'team_id' => ['required', 'integer', Rule::exists('teams', 'id')
                ->where('workspace_id', $project->workspace_id)],
            'role' => ['required', Rule::in(['responsable', 'editor', 'lector'])],
            'confirmed_member_ids' => ['required', 'array'],
            'confirmed_member_ids.*' => ['integer', 'distinct'],
        ]);

        abort_if(! empty($data['custom_role_id']) && $data['role'] !== 'lector', 422,
            'Los roles personalizados se asignan sin privilegios del rol base.');
        $team = Team::where('workspace_id', $project->workspace_id)->findOrFail($data['team_id']);
        $userIds = $team->members()->whereHas('workspaces', fn ($query) =>
            $query->where('workspaces.id', $project->workspace_id)
        )->get()->reject(fn ($user) => WorkspaceClientAccess::isClient($user, $project->workspace))
            ->pluck('id')->sort()->values()->all();
        $confirmed = collect($data['confirmed_member_ids'])->unique()->sort()->values()->all();
        if ($userIds !== $confirmed) {
            throw ValidationException::withMessages([
                'team_id' => 'La composición del equipo ha cambiado. Actualiza Personal y confirma de nuevo.',
            ]);
        }

        $added = DB::transaction(function () use ($project, $team, $userIds, $data) {
            DB::table('project_team')->insertOrIgnore([[
                'project_id' => $project->id, 'team_id' => $team->id,
                'created_at' => now(), 'updated_at' => now(),
            ]]);
            $added = 0;
            foreach ($userIds as $id) {
                $member = ProjectMember::firstOrCreate(
                    ['project_id' => $project->id, 'user_id' => $id],
                    ['role' => $data['role'], 'custom_role_id' => $data['custom_role_id'] ?? null]
                );
                if ($member->wasRecentlyCreated) $added++;
            }
            return $added;
        });

        return response()->json(['added' => $added, 'team_id' => $team->id], 201);
    }

    public function unlinkTeam(Request $request, Project $project, Team $team)
    {
        $this->authorizeManage($request, $project);
        abort_unless($team->workspace_id === $project->workspace_id, 404);
        DB::table('project_team')->where('project_id', $project->id)
            ->where('team_id', $team->id)->delete();

        // Intentionally leave individual memberships untouched; a member may
        // have been added directly or still be assigned work in this project.
        return response()->noContent();
    }

    private function authorizeManage(Request $request, Project $project): void
    {
        abort_unless(ProjectAccess::canManageMembers($request->user(), $project), 403);
    }

    private function ensureOtherResponsible(Project $project, int $exceptMemberId): void
    {
        if (! $project->members()->where('role', 'responsable')
            ->where('id', '!=', $exceptMemberId)->exists()) {
            throw ValidationException::withMessages([
                'role' => 'No puedes eliminar o cambiar el rol del último responsable del proyecto.',
            ]);
        }
    }
}
