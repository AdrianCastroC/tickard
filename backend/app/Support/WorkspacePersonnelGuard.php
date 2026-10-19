<?php

namespace App\Support;

use App\Models\Workspace;
use App\Support\WorkspaceClientAccess;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class WorkspacePersonnelGuard
{
    public static function resolve(Request $request, int $workspaceId, bool $write = false, string $permission = 'workspace.manage'): Workspace
    {
        $workspace = Workspace::findOrFail($workspaceId);
        $user = $request->user();
        $membership = $workspace->memberships()->where('user_id', $user->id)->first();

        abort_unless($membership && ! WorkspaceClientAccess::isClient($user, $workspace), 403);
        if ($write) {
            abort_unless(self::canManage($request, $workspace, $permission), 403);
        }
        return $workspace;
    }

    public static function canManage(Request $request, Workspace $workspace, string $permission = 'workspace.manage'): bool
    {
        $user = $request->user();
        $membership = $workspace->memberships()->where('user_id', $user->id)->first();
        if (! $membership && ! $user->is_admin) return false;
        if (WorkspaceClientAccess::isClient($user, $workspace)) return false;
        if ((int) $workspace->owner_id === (int) $user->id
            || (bool) $user->is_admin || in_array($membership?->role, ['owner', 'admin'], true)) return true;
        $custom = $membership?->customRole;
        return $custom !== null && $custom->scope === 'workspace'
            && (int) $custom->workspace_id === (int) $workspace->id
            && in_array($permission, $custom->permissions ?? [], true);
    }

    public static function validPeople(Workspace $workspace, array $ids): array
    {
        $ids = array_values(array_unique(array_map('intval', $ids)));
        $found = $workspace->members()->whereIn('users.id', $ids)->get()
            ->reject(fn ($user) => WorkspaceClientAccess::isClient($user, $workspace))
            ->pluck('id')->map(fn ($id) => (int) $id)->all();

        if (count($found) !== count($ids)) {
            throw ValidationException::withMessages([
                'member_ids' => 'Solo puedes incorporar miembros internos de este Workspace.',
            ]);
        }
        return $ids;
    }
}
