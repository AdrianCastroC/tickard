<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Department;
use App\Models\User;
use App\Models\Workspace;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class WorkspaceDepartmentsController extends Controller
{
    private function workspace(Request $request, int $id, bool $write = false): Workspace
    {
        $workspace = Workspace::findOrFail($id);
        $user = $request->user();
        $membership = $workspace->memberships()->where('user_id', $user->id)->first();

        // A global admin never receives implicit access to unrelated Workspaces.
        abort_unless($membership && ! $user->client_company_id, 403);
        if ($write) {
            abort_unless(
                (int) $workspace->owner_id === (int) $user->id
                || in_array($membership->role, ['owner', 'admin'], true)
                || $user->is_admin,
                403
            );
        }

        return $workspace;
    }

    private function canManage(Request $request, Workspace $workspace): bool
    {
        $membership = $workspace->memberships()->where('user_id', $request->user()->id)->first();
        return (int) $workspace->owner_id === (int) $request->user()->id
            || in_array($membership?->role, ['owner', 'admin'], true)
            || (bool) $request->user()->is_admin;
    }

    private function validPeople(Workspace $workspace, array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        $allowed = $workspace->members()->whereNull('client_company_id')
            ->whereIn('users.id', $ids)->pluck('users.id')->map(fn ($id) => (int) $id)->all();
        if (count($allowed) !== count($ids)) {
            throw ValidationException::withMessages([
                'member_ids' => 'Solo puedes incorporar personas pertenecientes a este Workspace.',
            ]);
        }
        return $ids;
    }

    public function index(Request $request)
    {
        $data = $request->validate(['workspace_id' => ['required', 'integer']]);
        $workspace = $this->workspace($request, (int) $data['workspace_id']);

        $departments = Department::with('members:id,name,avatar_path')
            ->where('workspace_id', $workspace->id)->orderBy('name')->get();

        $people = $workspace->members()->whereNull('client_company_id')
            ->orderBy('name')->get(['users.id', 'users.name', 'users.avatar_path']);

        $present = fn (User $user) => [
            'id' => $user->id, 'name' => $user->name, 'avatar_url' => $user->avatarUrl(),
        ];

        return response()->json([
            'can_manage' => $this->canManage($request, $workspace),
            'departments' => $departments->map(fn (Department $department) => [
                'id' => $department->id,
                'name' => $department->name,
                'lead_user_id' => $department->lead_user_id ? (int) $department->lead_user_id : null,
                'members' => $department->members->map($present)->values(),
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
            'lead_user_id' => ['nullable', 'integer'],
        ]);
        $workspace = $this->workspace($request, (int) $data['workspace_id'], true);
        $name = trim($data['name']);
        if ($name === '') {
            throw ValidationException::withMessages(['name' => 'Introduce un nombre para el departamento.']);
        }
        $request->validate(['name' => Rule::unique('departments')->where('workspace_id', $workspace->id)]);
        $memberIds = $this->validPeople($workspace, $data['member_ids'] ?? []);
        $leadId = $data['lead_user_id'] ?? null;
        if ($leadId !== null && ! in_array((int) $leadId, $memberIds, true)) {
            throw ValidationException::withMessages(['lead_user_id' => 'El responsable debe pertenecer al departamento.']);
        }

        $department = DB::transaction(function () use ($workspace, $name, $memberIds, $leadId) {
            $department = Department::create([
                'workspace_id' => $workspace->id, 'name' => $name, 'lead_user_id' => $leadId,
            ]);
            $department->members()->sync($memberIds);
            return $department;
        });

        return response()->json(['id' => $department->id], 201);
    }

    public function update(Request $request, Department $department)
    {
        $data = $request->validate([
            'workspace_id' => ['required', 'integer'],
            'name' => ['sometimes', 'required', 'string', 'max:80'],
            'member_ids' => ['sometimes', 'array'],
            'member_ids.*' => ['integer', 'distinct'],
            'lead_user_id' => ['sometimes', 'nullable', 'integer'],
        ]);
        $workspace = $this->workspace($request, (int) $data['workspace_id'], true);
        abort_unless((int) $department->workspace_id === (int) $workspace->id, 404);

        $name = trim($data['name'] ?? $department->name);
        if ($name === '') {
            throw ValidationException::withMessages(['name' => 'Introduce un nombre para el departamento.']);
        }
        $request->validate(['name' => Rule::unique('departments')
            ->where('workspace_id', $workspace->id)->ignore($department->id)]);

        $memberIds = $this->validPeople(
            $workspace,
            $data['member_ids'] ?? $department->members()->pluck('users.id')->all()
        );
        $leadId = $data['lead_user_id'] ?? (array_key_exists('lead_user_id', $data) ? null : $department->lead_user_id);
        if ($leadId !== null && ! in_array((int) $leadId, $memberIds, true)) {
            throw ValidationException::withMessages(['lead_user_id' => 'El responsable debe pertenecer al departamento.']);
        }

        DB::transaction(function () use ($department, $name, $leadId, $memberIds) {
            $department->update(['name' => $name, 'lead_user_id' => $leadId]);
            $department->members()->sync($memberIds);
        });

        return response()->noContent();
    }

    public function destroy(Request $request, Department $department)
    {
        $data = $request->validate(['workspace_id' => ['required', 'integer']]);
        $workspace = $this->workspace($request, (int) $data['workspace_id'], true);
        abort_unless((int) $department->workspace_id === (int) $workspace->id, 404);
        $department->delete();
        return response()->noContent();
    }
}
