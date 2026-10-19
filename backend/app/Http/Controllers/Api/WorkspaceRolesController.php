<?php

namespace App\Http\Controllers\Api;

use App\Models\Workspace;
use App\Models\WorkspaceCustomRole;
use Illuminate\Support\Facades\DB;
use App\Support\RolePermissions;
use App\Support\WorkspaceClientAccess;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class WorkspaceRolesController extends ApiController
{
    private const BUILTIN = [
        'owner' => ['name' => 'Owner', 'scope' => 'workspace', 'locked' => true],
        'admin' => ['name' => 'Administrador', 'scope' => 'workspace', 'locked' => false],
        'member' => ['name' => 'Miembro', 'scope' => 'workspace', 'locked' => false],
        'responsable' => ['name' => 'Responsable', 'scope' => 'project', 'locked' => false],
        'editor' => ['name' => 'Editor', 'scope' => 'project', 'locked' => false],
        'lector' => ['name' => 'Lector', 'scope' => 'project', 'locked' => false],
        'cliente' => ['name' => 'Cliente', 'scope' => 'project', 'locked' => true],
    ];

    public function setBuiltin(Request $request, Workspace $workspace, string $key)
    {
        $this->workspace($request, $workspace, true);
        abort_unless(isset(self::BUILTIN[$key]), 404);
        abort_if(self::BUILTIN[$key]['locked'], 422,
            'Este rol está protegido y no puede desactivarse.');
        $enabled = $request->validate(['enabled' => ['required', 'boolean']])['enabled'];
        DB::table('workspace_role_settings')->updateOrInsert(
            ['workspace_id' => $workspace->id, 'role_key' => $key],
            ['enabled' => $enabled, 'created_at' => now(), 'updated_at' => now()]
        );
        return response()->json(['key' => $key, 'enabled' => (bool) $enabled]);
    }

    private function workspace(Request $request, Workspace $workspace, bool $write = false): Workspace
    {
        abort_if(WorkspaceClientAccess::isClient($request->user(), $workspace), 403);
        abort_unless($workspace->memberships()->where('user_id', $request->user()->id)->exists(), 403);
        if ($write) {
            abort_unless((int) $workspace->owner_id === (int) $request->user()->id, 403);
        }
        return $workspace;
    }

    public function index(Request $request, Workspace $workspace)
    {
        $this->workspace($request, $workspace);
        return response()->json([
            'can_manage' => (int) $workspace->owner_id === (int) $request->user()->id,
            'permissions' => [
                'project' => RolePermissions::PROJECT,
                'workspace' => RolePermissions::WORKSPACE,
            ],
            'builtin_roles' => collect(self::BUILTIN)->map(function ($entry, $key) use ($workspace) {
                return ['key' => $key, ...$entry, 'enabled' => $key === 'owner' ? true :
                    (bool) (DB::table('workspace_role_settings')->where('workspace_id', $workspace->id)
                        ->where('role_key', $key)->value('enabled') ?? true)];
            })->values(),
            'roles' => WorkspaceCustomRole::where('workspace_id', $workspace->id)
                ->orderBy('scope')->orderBy('name')->get(),
        ]);
    }

    private function validateRole(Request $request, Workspace $workspace, ?WorkspaceCustomRole $role = null): array
    {
        $data = $request->validate([
            'scope' => [$role ? 'prohibited' : 'required', Rule::in(['workspace', 'project', 'both'])],
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'description' => ['nullable', 'string', 'max:255'],
            'permissions' => ['required', 'array'],
            'permissions.*' => ['required', 'string', 'distinct'],
            'enabled' => ['sometimes', 'boolean'],
        ]);
        $scope = $role?->scope ?? $data['scope'];
        $allowed = $scope === 'both' ? array_merge(RolePermissions::WORKSPACE, RolePermissions::PROJECT) : RolePermissions::allowed($scope);
        abort_if(array_diff($data['permissions'], $allowed), 422, 'Permisos no admitidos para este nivel.');
        abort_if(($scope === 'both' && (! in_array('project.view', $data['permissions'], true) || ! in_array('workspace.view', $data['permissions'], true)))
            || ($scope !== 'both' && ! in_array($scope === 'project' ? 'project.view' : 'workspace.view', $data['permissions'], true)),
            422, 'El rol debe permitir acceder al ámbito al que pertenece.');
        $name = trim($data['name']);
        $reserved = in_array($scope, ['project', 'both'], true)
            ? ['responsable', 'editor', 'lector', 'cliente', 'owner']
            : ['owner', 'propietario', 'administrador', 'admin', 'miembro', 'member', 'cliente', 'client'];
        abort_if(in_array(mb_strtolower($name), $reserved, true), 422,
            'El nombre está reservado para un rol del sistema.');
        $duplicate = WorkspaceCustomRole::where('workspace_id', $workspace->id)
            ->where('scope', $scope)->where('name', $name);
        if ($role) $duplicate->whereKeyNot($role->id);
        abort_if($duplicate->exists(), 422, 'Ya existe un rol con ese nombre.');
        return ['name' => $name, 'description' => $data['description'] ?? null,
            'permissions' => array_values($data['permissions']), 'scope' => $scope,
            'enabled' => $data['enabled'] ?? $role?->enabled ?? true];
    }

    public function store(Request $request, Workspace $workspace)
    {
        $this->workspace($request, $workspace, true);
        $data = $this->validateRole($request, $workspace);
        return response()->json(WorkspaceCustomRole::create(['workspace_id' => $workspace->id, ...$data]), 201);
    }

    public function update(Request $request, Workspace $workspace, WorkspaceCustomRole $role)
    {
        $this->workspace($request, $workspace, true);
        abort_unless($role->workspace_id === $workspace->id, 404);
        $values = $this->validateRole($request, $workspace, $role);
        $role->update($values);
        return response()->json($role->fresh());
    }

    public function destroy(Request $request, Workspace $workspace, WorkspaceCustomRole $role)
    {
        $this->workspace($request, $workspace, true);
        abort_unless($role->workspace_id === $workspace->id, 404);
        abort_if(in_array($role->scope, ['project', 'both'], true) && \App\Models\ProjectMember::where('custom_role_id', $role->id)->exists(), 422,
            'Reasigna antes a los miembros que utilizan este rol.');
        abort_if(in_array($role->scope, ['workspace', 'both'], true) && \App\Models\WorkspaceMember::where('custom_role_id', $role->id)->exists(), 422,
            'Reasigna antes a los miembros que utilizan este rol.');
        abort_if(\App\Models\WorkspaceInvitation::where('custom_role_id', $role->id)
            ->where('status', 'pending')->whereNull('revoked_at')->exists(), 422,
            'Cancela antes las invitaciones pendientes que utilizan este rol.');
        $role->delete();
        return response()->noContent();
    }
}
