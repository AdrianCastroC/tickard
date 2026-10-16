<?php

namespace App\Http\Controllers\Api;

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

class WorkspaceDepartmentsController extends ApiController
{
    private const ICONS = ['layers', 'code', 'palette', 'megaphone', 'settings', 'chart', 'users', 'box'];

    private function assertLinkedIds(Workspace $workspace, array $ids, string $type): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        $model = $type === 'team' ? Team::class : Project::class;
        $count = $model::where('workspace_id', $workspace->id)->whereIn('id', $ids)->count();
        if ($count !== count($ids)) {
            throw ValidationException::withMessages([
                $type.'_ids' => 'Solo puedes vincular '.($type === 'team' ? 'equipos' : 'proyectos').' del mismo Workspace.',
            ]);
        }
        return $ids;
    }

    private function validatePayload(Request $request, Workspace $workspace, ?Department $department = null): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80',
                Rule::unique('departments')->where('workspace_id', $workspace->id)->ignore($department?->id)],
            'description' => ['nullable', 'string', 'max:1000'],
            'status' => ['sometimes', Rule::in(['active', 'inactive'])],
            'icon' => ['sometimes', Rule::in(self::ICONS)],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer', 'distinct'],
            'lead_user_id' => ['required', 'integer'],
            'team_ids' => ['sometimes', 'array'],
            'team_ids.*' => ['integer', 'distinct'],
            'project_ids' => ['sometimes', 'array'],
            'project_ids.*' => ['integer', 'distinct'],
        ]);
        $data['name'] = trim($data['name']);
        if ($data['name'] === '') {
            throw ValidationException::withMessages(['name' => 'Introduce un nombre para el departamento.']);
        }
        $data['description'] = isset($data['description']) ? trim($data['description']) : null;
        $data['member_ids'] = Guard::validPeople(
            $workspace, $data['member_ids'] ?? $department?->members()->pluck('users.id')->all() ?? []
        );
        $data['team_ids'] = $this->assertLinkedIds(
            $workspace, $data['team_ids'] ?? $department?->teams()->pluck('teams.id')->all() ?? [], 'team'
        );
        $data['project_ids'] = $this->assertLinkedIds(
            $workspace, $data['project_ids'] ?? $department?->projects()->pluck('projects.id')->all() ?? [], 'project'
        );
        if (! in_array((int) $data['lead_user_id'], $data['member_ids'], true)) {
            throw ValidationException::withMessages([
                'lead_user_id' => 'El responsable debe pertenecer al departamento.',
            ]);
        }
        return $data;
    }

    public function index(Request $request)
    {
        $data = $request->validate(['workspace_id' => ['required', 'integer']]);
        $workspace = Guard::resolve($request, (int) $data['workspace_id']);

        $departments = Department::with([
            'members:id,name,avatar_path',
            'teams:id,name',
            'projects:id,name',
        ])->where('workspace_id', $workspace->id)->orderBy('name')->get();

        $people = $workspace->members()->orderBy('name')
            ->get(['users.id', 'users.name', 'users.avatar_path'])
            ->reject(fn ($user) => WorkspaceClientAccess::isClient($user, $workspace))->values();
        $teams = $workspace->teams()->withCount('members')->orderBy('name')->get(['id', 'name', 'workspace_id']);
        $projects = $workspace->projects()->orderBy('name')->get(['id', 'name', 'workspace_id']);
        $present = fn (User $user) => [
            'id' => $user->id, 'name' => $user->name, 'avatar_url' => $user->avatarUrl(),
        ];

        return response()->json([
            'can_manage' => Guard::canManage($request, $workspace),
            'departments' => $departments->map(fn (Department $department) => [
                'id' => $department->id,
                'name' => $department->name,
                'description' => $department->description,
                'status' => $department->status,
                'icon' => $department->icon,
                'image_url' => $department->image_path ? '/storage/'.$department->image_path : null,
                'created_at' => $department->created_at?->toIso8601String(),
                'updated_at' => $department->updated_at?->toIso8601String(),
                'lead_user_id' => $department->lead_user_id ? (int) $department->lead_user_id : null,
                'members' => $department->members->map($present)->values(),
                'teams' => $department->teams->map(fn (Team $team) => [
                    'id' => $team->id, 'name' => $team->name,
                ])->values(),
                'projects' => $department->projects->map(fn (Project $project) => [
                    'id' => $project->id, 'name' => $project->name,
                ])->values(),
            ])->values(),
            'people' => $people->map($present)->values(),
            'teams' => $teams->map(fn (Team $team) => [
                'id' => $team->id, 'name' => $team->name, 'members_count' => $team->members_count,
            ])->values(),
            'projects' => $projects->map(fn (Project $project) => [
                'id' => $project->id, 'name' => $project->name,
            ])->values(),
        ]);
    }

    public function store(Request $request)
    {
        $workspaceId = (int) $request->validate(['workspace_id' => ['required', 'integer']])['workspace_id'];
        $workspace = Guard::resolve($request, $workspaceId, true);
        $data = $this->validatePayload($request, $workspace);

        $department = DB::transaction(function () use ($workspace, $data) {
            $department = Department::create([
                'workspace_id' => $workspace->id,
                'name' => $data['name'],
                'description' => $data['description'],
                'status' => $data['status'] ?? 'active',
                'icon' => $data['icon'] ?? 'layers',
                'lead_user_id' => $data['lead_user_id'],
            ]);
            $department->members()->sync($data['member_ids']);
            $department->teams()->sync($data['team_ids']);
            $department->projects()->sync($data['project_ids']);
            return $department;
        });
        return response()->json(['id' => $department->id], 201);
    }

    public function update(Request $request, Department $department)
    {
        $workspaceId = (int) $request->validate(['workspace_id' => ['required', 'integer']])['workspace_id'];
        $workspace = Guard::resolve($request, $workspaceId, true);
        abort_unless((int) $department->workspace_id === (int) $workspace->id, 404);
        $data = $this->validatePayload($request, $workspace, $department);

        DB::transaction(function () use ($department, $data) {
            $department->update([
                'name' => $data['name'],
                'description' => $data['description'],
                'status' => $data['status'] ?? $department->status,
                'icon' => $data['icon'] ?? $department->icon,
                'lead_user_id' => $data['lead_user_id'],
            ]);
            $department->members()->sync($data['member_ids']);
            $department->teams()->sync($data['team_ids']);
            $department->projects()->sync($data['project_ids']);
        });
        return response()->noContent();
    }

    public function destroy(Request $request, Department $department)
    {
        $data = $request->validate(['workspace_id' => ['required', 'integer']]);
        $workspace = Guard::resolve($request, (int) $data['workspace_id'], true);
        abort_unless((int) $department->workspace_id === (int) $workspace->id, 404);
        $department->delete();
        return response()->noContent();
    }
}
