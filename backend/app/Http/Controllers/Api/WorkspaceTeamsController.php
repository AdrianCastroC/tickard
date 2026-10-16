<?php

namespace App\Http\Controllers\Api;

use App\Models\Board;
use App\Models\Team;
use App\Models\User;
use App\Support\WorkspacePersonnelGuard as Guard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class WorkspaceTeamsController extends ApiController
{
    public function index(Request $request)
    {
        $data = $request->validate(['workspace_id' => ['required', 'integer']]);
        $workspace = Guard::resolve($request, (int) $data['workspace_id']);
        $teams = Team::with(['members:id,name,avatar_path'])
            ->withCount(['projects', 'cards'])
            ->where('workspace_id', $workspace->id)->orderBy('name')->get();
        $people = $workspace->members()->whereNull('client_company_id')
            ->orderBy('name')->get(['users.id', 'users.name', 'users.avatar_path']);
        $present = fn (User $user) => [
            'id' => $user->id, 'name' => $user->name, 'avatar_url' => $user->avatarUrl(),
        ];

        return response()->json([
            'can_manage' => Guard::canManage($request, $workspace),
            'teams' => $teams->map(fn (Team $team) => [
                'id' => $team->id, 'name' => $team->name,
                'members' => $team->members->map($present)->values(),
                'projects_count' => $team->projects_count,
                'cards_count' => $team->cards_count,
            ])->values(),
            'people' => $people->map($present)->values(),
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'workspace_id' => ['required', 'integer'],
            'name' => ['required', 'string', 'max:80'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer', 'distinct'],
        ]);
        $workspace = Guard::resolve($request, (int) $data['workspace_id'], true);
        $name = trim($data['name']);
        if ($name === '') {
            throw ValidationException::withMessages(['name' => 'Introduce un nombre para el equipo.']);
        }
        $request->validate(['name' => Rule::unique('teams')->where('workspace_id', $workspace->id)]);
        $memberIds = Guard::validPeople($workspace, $data['member_ids'] ?? []);

        $team = DB::transaction(function () use ($workspace, $name, $memberIds) {
            $team = Team::create(['workspace_id' => $workspace->id, 'name' => $name]);
            $team->members()->sync($memberIds);
            return $team;
        });
        return response()->json(['id' => $team->id], 201);
    }

    public function update(Request $request, Team $team)
    {
        $data = $request->validate([
            'workspace_id' => ['required', 'integer'],
            'name' => ['sometimes', 'required', 'string', 'max:80'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer', 'distinct'],
        ]);
        $workspace = Guard::resolve($request, (int) $data['workspace_id'], true);
        abort_unless((int) $team->workspace_id === (int) $workspace->id, 404);
        $name = trim($data['name'] ?? $team->name);
        if ($name === '') {
            throw ValidationException::withMessages(['name' => 'Introduce un nombre para el equipo.']);
        }
        $request->validate(['name' => Rule::unique('teams')
            ->where('workspace_id', $workspace->id)->ignore($team->id)]);
        $members = Guard::validPeople(
            $workspace, $data['member_ids'] ?? $team->members()->pluck('users.id')->all()
        );
        $before = $team->members()->pluck('users.id')->map(fn ($id) => (int) $id)->sort()->values()->all();
        $after = collect($members)->sort()->values()->all();
        DB::transaction(function () use ($team, $name, $members, $workspace, $before, $after) {
            $team->update(['name' => $name]);
            $team->members()->sync($members);
            if ($before !== $after) {
                // Team membership affects the assignee chips and permissions for linked cards.
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
