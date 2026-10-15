<?php

namespace App\Http\Controllers\Api;

use App\Models\Card;
use App\Models\Department;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Team;
use App\Models\User;
use App\Support\ProjectAccess;
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
        $canManage = ProjectAccess::canManage($request->user(), $project);

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
                'columns.workflow_state', 'card_user.user_id',
            ])->get();

        $today = now()->toDateString();
        $tasks = $assignments->unique('id')->values();
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

        $people = $memberships->map(function (ProjectMember $membership) use (
            $assignedByUser, $teams, $departments, $countStates, $today, $client, $project
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
                'avatar_url' => $user->avatarUrl(),
                'role' => (int) $project->workspace->owner_id === (int) $user->id ? 'responsable' : $membership->role,
                'is_workspace_owner' => (int) $project->workspace->owner_id === (int) $user->id,
                'teams' => $client ? [] : $teams->filter(fn ($team) =>
                    $team->members->contains('id', $user->id)
                )->map(fn ($team) => ['id' => $team->id, 'name' => $team->name])->values(),
                'departments' => $client ? [] : $departments->filter(fn ($department) =>
                    $department->members->contains('id', $user->id)
                )->map(fn ($department) => ['id' => $department->id, 'name' => $department->name])->values(),
                'stats' => $countStates($assigned),
                'tasks' => $ordered->map(fn ($row) => [
                    'id' => $row->id,
                    'title' => $row->title,
                    'board_id' => $row->board_id,
                    'board_name' => $row->board_name,
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
            ? $project->workspace->members()->whereNull('client_company_id')
                ->pluck('users.id')->all()
            : [];

        return response()->json([
            'members' => $people,
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
                    ->whereNull('client_company_id')
                    ->get(['users.id', 'users.name', 'users.email'])
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
        ]);
        $member = ProjectMember::firstOrCreate([
            'project_id' => $project->id,
            'user_id' => $data['user_id'],
        ], ['role' => $data['role']]);

        return response()->json([
            'added' => $member->wasRecentlyCreated,
            'role' => $member->role,
        ], $member->wasRecentlyCreated ? 201 : 200);
    }

    public function updateMember(Request $request, Project $project, User $user)
    {
        $this->authorizeManage($request, $project);
        $data = $request->validate(['role' => ['required', Rule::in(self::ROLES)]]);
        abort_if(ProjectAccess::isWorkspaceOwner($user, $project), 403,
            'El propietario del Workspace no puede perder su rol desde un proyecto.');
        $member = $project->members()->where('user_id', $user->id)->firstOrFail();
        if ($member->role === 'responsable' && $data['role'] !== 'responsable') {
            $this->ensureOtherResponsible($project, $member->id);
        }
        $member->update(['role' => $data['role']]);

        return response()->json(['role' => $member->role]);
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
            'confirmed_member_ids.*' => ['integer'],
        ]);

        $team = Team::where('workspace_id', $project->workspace_id)->findOrFail($data['team_id']);
        $userIds = $team->members()->whereHas('workspaces', fn ($query) =>
            $query->where('workspaces.id', $project->workspace_id)
        )->whereNull('client_company_id')->pluck('users.id')->sort()->values()->all();
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
                    ['role' => $data['role']]
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
        abort_unless(ProjectAccess::canManage($request->user(), $project), 403);
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
