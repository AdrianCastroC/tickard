<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Api\ApiController;
use App\Models\AppNotification;
use App\Models\Board;
use App\Models\BoardCategory;
use App\Models\Card;
use App\Models\CardAttachment;
use App\Models\CardChecklistItem;
use App\Models\CardModule;
use App\Models\ClientCompany;
use App\Models\Column;
use App\Models\Comment;
use App\Models\Department;
use App\Models\Invitation;
use App\Models\Label;
use App\Models\Project;
use App\Models\ProjectMember;
use App\Models\Team;
use App\Models\User;
use App\Models\Workspace;
use App\Support\CardPresenter;
use App\Support\Notifier;
use App\Support\ProjectAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdministrationController extends ApiController
{
    public function departments(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);
    
        $data = $request->validate([
            'workspace_id' => ['required', 'integer'],
        ]);
    
        $workspace = Workspace::whereKey($data['workspace_id'])
            ->whereHas('members', fn ($query) =>
                $query->where('users.id', $request->user()->id)
            )
            ->firstOrFail();
    
        return [
            'departments' => Department::with('members:id,name')
                ->where('workspace_id', $workspace->id)
                ->orderBy('name')
                ->get()
                ->map(fn (Department $department) => [
                    'id' => $department->id,
                    'name' => $department->name,
                    'members' => $department->members
                        ->map(fn (User $member) => [
                            'id' => $member->id,
                            'name' => $member->name,
                        ])
                        ->values(),
                ])
                ->values(),
    
            'people' => $workspace->members()
                ->whereNull('client_company_id')
                ->orderBy('name')
                ->get(['users.id', 'users.name'])
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                ])
                ->values(),
        ];
    }
    
    public function storeDepartment(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);
    
        $data = $request->validate([
            'workspace_id' => ['required', 'integer'],
            'name' => ['required', 'string', 'max:80'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer'],
        ]);
    
        $workspace = Workspace::whereKey($data['workspace_id'])
            ->whereHas('members', fn ($query) =>
                $query->where('users.id', $request->user()->id)
            )
            ->firstOrFail();
    
        $memberIds = $workspace->members()
            ->whereNull('client_company_id')
            ->whereIn('users.id', $data['member_ids'] ?? [])
            ->pluck('users.id')
            ->all();
    
        $department = Department::create([
            'workspace_id' => $workspace->id,
            'name' => $data['name'],
        ]);
    
        $department->members()->sync($memberIds);
    
        return response()->json([
            'id' => $department->id,
        ], 201);
    }
    
    public function updateDepartment(Request $request, Department $department)
    {
        abort_unless($request->user()->is_admin, 403);
    
        $data = $request->validate([
            'workspace_id' => ['required', 'integer'],
            'name' => ['sometimes', 'string', 'max:80'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer'],
        ]);
    
        $workspace = Workspace::whereKey($data['workspace_id'])
            ->whereHas('members', fn ($query) =>
                $query->where('users.id', $request->user()->id)
            )
            ->firstOrFail();
    
        abort_unless(
            $department->workspace_id === $workspace->id,
            404
        );
    
        if (array_key_exists('name', $data)) {
            $department->update([
                'name' => $data['name'],
            ]);
        }
    
        if (array_key_exists('member_ids', $data)) {
            $memberIds = $workspace->members()
                ->whereNull('client_company_id')
                ->whereIn('users.id', $data['member_ids'])
                ->pluck('users.id')
                ->all();
    
            $department->members()->sync($memberIds);
        }
    
        return response()->noContent();
    }
    
    public function destroyDepartment(Request $request, Department $department)
    {
        abort_unless($request->user()->is_admin, 403);
    
        $data = $request->validate([
            'workspace_id' => ['required', 'integer'],
        ]);
    
        $workspace = Workspace::whereKey($data['workspace_id'])
            ->whereHas('members', fn ($query) =>
                $query->where('users.id', $request->user()->id)
            )
            ->firstOrFail();
    
        abort_unless(
            $department->workspace_id === $workspace->id,
            404
        );
    
        $department->delete();
    
        return response()->noContent();
    }

    public function teams(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);

        $data = $request->validate([
            'workspace_id' => ['required', 'integer'],
        ]);

        $workspace = Workspace::whereKey($data['workspace_id'])
            ->whereHas('members', fn ($query) =>
                $query->where('users.id', $request->user()->id)
            )
            ->firstOrFail();

        return [
            'teams' => Team::with('members:id,name')
                ->where('workspace_id', $workspace->id)
                ->orderBy('name')
                ->get()
                ->map(fn (Team $team) => [
                    'id' => $team->id,
                    'name' => $team->name,
                    'members' => $team->members
                        ->map(fn (User $member) => [
                            'id' => $member->id,
                            'name' => $member->name,
                        ])
                        ->values(),
                ])
                ->values(),

            'people' => $workspace->members()
                ->whereNull('client_company_id')
                ->orderBy('name')
                ->get(['users.id', 'users.name'])
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                ])
                ->values(),
        ];
    }

    public function storeTeam(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);

        $data = $request->validate([
            'workspace_id' => ['required', 'integer'],
            'name' => ['required', 'string', 'max:80'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer'],
        ]);

        $workspace = Workspace::whereKey($data['workspace_id'])
            ->whereHas('members', fn ($query) =>
                $query->where('users.id', $request->user()->id)
            )
            ->firstOrFail();

        $memberIds = $workspace->members()
            ->whereNull('client_company_id')
            ->whereIn('users.id', $data['member_ids'] ?? [])
            ->pluck('users.id')
            ->all();

        $team = Team::create([
            'workspace_id' => $workspace->id,
            'name' => $data['name'],
        ]);

        $team->members()->sync($memberIds);

        return response()->json([
            'id' => $team->id,
        ], 201);
    }

    public function updateTeam(Request $request, Team $team)
    {
        abort_unless($request->user()->is_admin, 403);

        $data = $request->validate([
            'workspace_id' => ['required', 'integer'],
            'name' => ['sometimes', 'string', 'max:80'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer'],
        ]);

        $workspace = Workspace::whereKey($data['workspace_id'])
            ->whereHas('members', fn ($query) =>
                $query->where('users.id', $request->user()->id)
            )
            ->firstOrFail();

        abort_unless(
            $team->workspace_id === $workspace->id,
            404
        );

        if (array_key_exists('name', $data)) {
            $team->update([
                'name' => $data['name'],
            ]);
        }

        if (array_key_exists('member_ids', $data)) {
            $memberIds = $workspace->members()
                ->whereNull('client_company_id')
                ->whereIn('users.id', $data['member_ids'])
                ->pluck('users.id')
                ->all();

            $team->members()->sync($memberIds);
        }

        Board::whereHas('project', fn ($query) =>
            $query->where('workspace_id', $workspace->id)
        )->increment('revision');

        return response()->noContent();
    }

    public function destroyTeam(Request $request, Team $team)
    {
        abort_unless($request->user()->is_admin, 403);

        $data = $request->validate([
            'workspace_id' => ['required', 'integer'],
        ]);

        $workspace = Workspace::whereKey($data['workspace_id'])
            ->whereHas('members', fn ($query) =>
                $query->where('users.id', $request->user()->id)
            )
            ->firstOrFail();

        abort_unless(
            $team->workspace_id === $workspace->id,
            404
        );

        $team->delete();

        Board::whereHas('project', fn ($query) =>
            $query->where('workspace_id', $workspace->id)
        )->increment('revision');

        return response()->noContent();
    }

    public function clients(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);
    
        $data = $request->validate([
            'workspace_id' => ['required', 'integer'],
        ]);
    
        $workspace = Workspace::whereKey($data['workspace_id'])
            ->whereHas('members', fn ($query) =>
                $query->where('users.id', $request->user()->id)
            )
            ->firstOrFail();
    
        return ClientCompany::withCount(['projects', 'users'])
            ->where('workspace_id', $workspace->id)
            ->orderBy('name')
            ->get()
            ->map(fn (ClientCompany $client) => [
                'id' => $client->id,
                'name' => $client->name,
                'projects_count' => $client->projects_count,
                'people_count' => $client->users_count,
            ])
            ->values();
    }
    
    public function storeClient(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);
    
        $data = $request->validate([
            'workspace_id' => ['required', 'integer'],
            'name' => ['required', 'string', 'max:120'],
        ]);
    
        $workspace = Workspace::whereKey($data['workspace_id'])
            ->whereHas('members', fn ($query) =>
                $query->where('users.id', $request->user()->id)
            )
            ->firstOrFail();
    
        $client = ClientCompany::create([
            'workspace_id' => $workspace->id,
            'name' => $data['name'],
        ]);
    
        return response()->json([
            'id' => $client->id,
        ], 201);
    }
}