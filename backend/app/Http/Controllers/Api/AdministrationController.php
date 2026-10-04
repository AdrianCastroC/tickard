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
public function teams(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);

        return [
            'teams' => Team::with('members:id,name')->orderBy('name')->get()->map(fn (Team $team) => [
                'id' => $team->id,
                'name' => $team->name,
                'members' => $team->members->map(fn (User $member) => [
                    'id' => $member->id,
                    'name' => $member->name,
                ])->values(),
            ])->values(),
            'people' => User::whereNull('client_company_id')->orderBy('name')->get(['id', 'name']),
        ];
    }

public function storeTeam(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer'],
        ]);

        $team = Team::create(['name' => $data['name']]);
        $team->members()->sync($this->internalIds($data['member_ids'] ?? []));

        return response()->json(['id' => $team->id], 201);
    }

public function updateTeam(Request $request, Team $team)
    {
        abort_unless($request->user()->is_admin, 403);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer'],
        ]);

        if (array_key_exists('name', $data)) {
            $team->update(['name' => $data['name']]);
        }
        if (array_key_exists('member_ids', $data)) {
            $team->members()->sync($this->internalIds($data['member_ids']));
        }
        Board::query()->increment('revision');

        return response()->noContent();
    }

public function destroyTeam(Request $request, Team $team)
    {
        abort_unless($request->user()->is_admin, 403);
        $team->delete();
        Board::query()->increment('revision');

        return response()->noContent();
    }

public function departments(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);

        return [
            'departments' => Department::with('members:id,name')->orderBy('name')->get()->map(fn (Department $department) => [
                'id' => $department->id,
                'name' => $department->name,
                'members' => $department->members->map(fn (User $member) => [
                    'id' => $member->id,
                    'name' => $member->name,
                ])->values(),
            ])->values(),
            'people' => User::whereNull('client_company_id')->orderBy('name')->get(['id', 'name']),
        ];
    }

public function storeDepartment(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer'],
        ]);

        $department = Department::create(['name' => $data['name']]);
        $department->members()->sync($this->internalIds($data['member_ids'] ?? []));

        return response()->json(['id' => $department->id], 201);
    }

public function updateDepartment(Request $request, Department $department)
    {
        abort_unless($request->user()->is_admin, 403);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer'],
        ]);

        if (array_key_exists('name', $data)) {
            $department->update(['name' => $data['name']]);
        }
        if (array_key_exists('member_ids', $data)) {
            $department->members()->sync($this->internalIds($data['member_ids']));
        }

        return response()->noContent();
    }

public function destroyDepartment(Request $request, Department $department)
    {
        abort_unless($request->user()->is_admin, 403);
        $department->delete();

        return response()->noContent();
    }

public function clients(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);

        return ClientCompany::withCount(['projects', 'users'])->orderBy('name')->get()->map(fn (ClientCompany $client) => [
            'id' => $client->id,
            'name' => $client->name,
            'projects_count' => $client->projects_count,
            'people_count' => $client->users_count,
        ])->values();
    }

public function storeClient(Request $request)
    {
        abort_unless($request->user()->is_admin, 403);
        $data = $request->validate(['name' => ['required', 'string', 'max:120']]);
        $client = ClientCompany::create(['name' => $data['name']]);

        return response()->json(['id' => $client->id], 201);
    }
}
