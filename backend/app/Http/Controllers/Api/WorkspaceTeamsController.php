<?php

namespace App\Http\Controllers\Api;

use App\Models\Board;
use App\Models\Department;
use App\Models\Project;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Support\WorkspacePersonnelGuard as Guard;
use App\Support\WorkspaceClientAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class WorkspaceTeamsController extends ApiController
{
    private const ICONS = ['users', 'code', 'layers', 'palette', 'megaphone', 'settings', 'chart', 'box'];

    private function linkedIds(Workspace $workspace, array $ids, string $kind): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        $model = $kind === 'department' ? Department::class : Project::class;
        if ($model::where('workspace_id', $workspace->id)->whereIn('id', $ids)->count() !== count($ids)) {
            throw ValidationException::withMessages([
                $kind.'_ids' => 'Solo puedes vincular '.($kind === 'department' ? 'departamentos' : 'proyectos').' del mismo Workspace.',
            ]);
        }
        return $ids;
    }

    private function payload(Request $request, Workspace $workspace, ?Team $team = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80',
                Rule::unique('teams')->where('workspace_id', $workspace->id)->ignore($team?->id)],
            'description' => ['nullable', 'string', 'max:1000'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'icon' => ['sometimes', Rule::in(self::ICONS)],
            'lead_user_id' => ['required', 'integer'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer', 'distinct'],
            'department_ids' => ['sometimes', 'array'],
            'department_ids.*' => ['integer', 'distinct'],
            'project_ids' => ['sometimes', 'array'],
            'project_ids.*' => ['integer', 'distinct'],
        ]);
        $data['name'] = trim($data['name']);
        if ($data['name'] === '') {
            throw ValidationException::withMessages(['name' => 'Introduce un nombre para el equipo.']);
        }
        $data['description'] = isset($data['description']) ? trim($data['description']) : null;
        $data['member_ids'] = Guard::validPeople(
            $workspace, $data['member_ids'] ?? $team?->members()->pluck('users.id')->all() ?? []
        );
        if (! in_array((int) $data['lead_user_id'], $data['member_ids'], true)) {
            throw ValidationException::withMessages([
                'lead_user_id' => 'El responsable debe pertenecer al equipo.',
            ]);
        }
        $data['department_ids'] = $this->linkedIds(
            $workspace, $data['department_ids'] ?? $team?->departments()->pluck('departments.id')->all() ?? [], 'department'
        );
        $data['project_ids'] = $this->linkedIds(
            $workspace, $data['project_ids'] ?? $team?->projects()->pluck('projects.id')->all() ?? [], 'project'
        );
        return $data;
    }

    public function index(Request $request)
    {
        $data = $request->validate(['workspace_id' => ['required', 'integer']]);
        $workspace = Guard::resolve($request, (int) $data['workspace_id']);
        $teams = Team::with([
            'members:id,name,avatar_path', 'departments:id,name', 'projects:id,name',
        ])->withCount('cards')
            ->where('workspace_id', $workspace->id)->orderBy('name')->get();
        $people = $workspace->members()->orderBy('name')
            ->get(['users.id', 'users.name', 'users.avatar_path'])
            ->reject(fn ($user) => WorkspaceClientAccess::isClient($user, $workspace))->values();
        $departments = $workspace->departments()->orderBy('name')->get(['id', 'name', 'workspace_id']);
        $projects = $workspace->projects()->orderBy('name')->get(['id', 'name', 'workspace_id']);
        $present = fn (User $user) => [
            'id' => $user->id, 'name' => $user->name, 'avatar_url' => $user->avatarUrl(),
        ];

        return response()->json([
            'can_manage' => Guard::canManage($request, $workspace),
            'teams' => $teams->map(fn (Team $team) => [
                'id' => $team->id, 'name' => $team->name,
                'description' => $team->description,
                'status' => $team->status, 'icon' => $team->icon,
                'image_url' => $team->image_path ? '/storage/'.$team->image_path : null,
                'lead_user_id' => $team->lead_user_id ? (int) $team->lead_user_id : null,
                'created_at' => $team->created_at?->toIso8601String(),
                'updated_at' => $team->updated_at?->toIso8601String(),
                'members' => $team->members->map($present)->values(),
                'departments' => $team->departments->map(fn (Department $dept) => [
                    'id' => $dept->id, 'name' => $dept->name,
                ])->values(),
                'projects' => $team->projects->map(fn (Project $project) => [
                    'id' => $project->id, 'name' => $project->name,
                ])->values(),
                'projects_count' => $team->projects->count(),
                'cards_count' => $team->cards_count,
            ])->values(),
            'people' => $people->map($present)->values(),
            'departments' => $departments->map(fn (Department $dept) => [
                'id' => $dept->id, 'name' => $dept->name,
            ])->values(),
            'projects' => $projects->map(fn (Project $project) => [
                'id' => $project->id, 'name' => $project->name,
            ])->values(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate(['workspace_id' => ['required', 'integer']]);
        $workspace = Guard::resolve($request, (int) $data['workspace_id'], true);
        $values = $this->payload($request, $workspace);
        $team = DB::transaction(function () use ($workspace, $values) {
            $team = Team::create([
                'workspace_id' => $workspace->id, 'name' => $values['name'],
                'description' => $values['description'], 'status' => $values['status'] ?? 'active',
                'icon' => $values['icon'] ?? 'users',
                'lead_user_id' => $values['lead_user_id'],
            ]);
            $team->members()->sync($values['member_ids']);
            $team->departments()->sync($values['department_ids']);
            $team->projects()->sync($values['project_ids']);
            return $team;
        });
        return response()->json(['id' => $team->id], 201);
    }

    public function update(Request $request, Team $team)
    {
        $data = $request->validate(['workspace_id' => ['required', 'integer']]);
        $workspace = Guard::resolve($request, (int) $data['workspace_id'], true);
        abort_unless((int) $team->workspace_id === (int) $workspace->id, 404);
        $values = $this->payload($request, $workspace, $team);

        $beforeMembers = $team->members()->pluck('users.id')->map(fn ($id) => (int) $id)->sort()->values()->all();
        $afterMembers = collect($values['member_ids'])->sort()->values()->all();
        $beforeProjects = $team->projects()->pluck('projects.id')->map(fn ($id) => (int) $id)->sort()->values()->all();
        $afterProjects = collect($values['project_ids'])->sort()->values()->all();

        DB::transaction(function () use ($team, $workspace, $values, $beforeMembers, $afterMembers, $beforeProjects, $afterProjects) {
            $team->update([
                'name' => $values['name'],
                'description' => $values['description'],
                'status' => $values['status'] ?? $team->status,
                'icon' => $values['icon'] ?? $team->icon,
                'lead_user_id' => $values['lead_user_id'],
            ]);
            $team->members()->sync($values['member_ids']);
            $team->departments()->sync($values['department_ids']);
            $team->projects()->sync($values['project_ids']);
            if ($beforeMembers !== $afterMembers || $beforeProjects !== $afterProjects) {
                Board::whereHas('project', fn ($query) =>
                    $query->where('workspace_id', $workspace->id)
                )->increment('revision');
            }
        });
        return response()->noContent();
    }

    public function destroy(Request $request, Team $team)
    {
        $data = $request->validate(['workspace_id' => ['required', 'integer']]);
        $workspace = Guard::resolve($request, (int) $data['workspace_id'], true);
        abort_unless((int) $team->workspace_id === (int) $workspace->id, 404);
        DB::transaction(function () use ($team, $workspace) {
            $team->departments()->detach();
            $team->members()->detach();
            $team->projects()->detach();
            $team->cards()->detach();
            $team->delete();
            Board::whereHas('project', fn ($query) =>
                $query->where('workspace_id', $workspace->id)
            )->increment('revision');
        });
        return response()->noContent();
    }
}
