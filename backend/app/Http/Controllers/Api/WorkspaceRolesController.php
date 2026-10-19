<?php

namespace App\Http\Controllers\Api;

use App\Models\Workspace;
use App\Models\WorkspaceCustomRole;
use App\Support\RolePermissions;
use App\Support\WorkspaceClientAccess;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class WorkspaceRolesController extends ApiController
{
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
            'roles' => WorkspaceCustomRole::where('workspace_id', $workspace->id)
                ->orderBy('scope')->orderBy('name')->get(),
        ]);
    }

    private function validateRole(Request $request, Workspace $workspace, ?WorkspaceCustomRole $role = null): array
    {
        $data = $request->validate([
            'scope' => [$role ? 'prohibited' : 'required', Rule::in(['workspace', 'project'])],
            'name' => ['required', 'string', 'min:2', 'max:80'],
            'description' => ['nullable', 'string', 'max:255'],
            'permissions' => ['required', 'array'],
            'permissions.*' => ['required', 'string', 'distinct'],
        ]);
        $scope = $role?->scope ?? $data['scope'];
        $allowed = RolePermissions::allowed($scope);
        abort_if(array_diff($data['permissions'], $allowed), 422, 'Permisos no admitidos para este nivel.');
        abort_if(! in_array($scope === 'project' ? 'project.view' : 'workspace.view', $data['permissions'], true),
            422, 'El rol debe permitir acceder al ámbito al que pertenece.');
        $name = trim($data['name']);
        $reserved = $scope === 'project'
            ? ['responsable', 'editor', 'lector', 'cliente', 'owner']
            : ['owner', 'propietario', 'administrador', 'admin', 'miembro', 'member', 'cliente', 'client'];
        abort_if(in_array(mb_strtolower($name), $reserved, true), 422,
            'El nombre está reservado para un rol del sistema.');
        $duplicate = WorkspaceCustomRole::where('workspace_id', $workspace->id)
            ->where('scope', $scope)->where('name', $name);
        if ($role) $duplicate->whereKeyNot($role->id);
        abort_if($duplicate->exists(), 422, 'Ya existe un rol con ese nombre.');
        return ['name' => $name, 'description' => $data['description'] ?? null,
            'permissions' => array_values($data['permissions']), 'scope' => $scope];
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
        $role->update($this->validateRole($request, $workspace, $role));
        return response()->json($role->fresh());
    }

    public function destroy(Request $request, Workspace $workspace, WorkspaceCustomRole $role)
    {
        $this->workspace($request, $workspace, true);
        abort_unless($role->workspace_id === $workspace->id, 404);
        abort_if($role->scope === 'project' && \App\Models\ProjectMember::where('custom_role_id', $role->id)->exists(), 422,
            'Reasigna antes a los miembros que utilizan este rol.');
        abort_if($role->scope === 'workspace' && \App\Models\WorkspaceMember::where('custom_role_id', $role->id)->exists(), 422,
            'Reasigna antes a los miembros que utilizan este rol.');
        abort_if(\App\Models\WorkspaceInvitation::where('custom_role_id', $role->id)
            ->where('status', 'pending')->whereNull('revoked_at')->exists(), 422,
            'Cancela antes las invitaciones pendientes que utilizan este rol.');
        $role->delete();
        return response()->noContent();
    }
}
