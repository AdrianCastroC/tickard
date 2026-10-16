<?php

namespace App\Support;

use App\Models\Workspace;
use App\Support\WorkspaceClientAccess;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class WorkspacePersonnelGuard
{
    public static function resolve(Request $request, int $workspaceId, bool $write = false): Workspace
    {
        $workspace = Workspace::findOrFail($workspaceId);
        $user = $request->user();
        $membership = $workspace->memberships()->where('user_id', $user->id)->first();

        abort_unless($membership && ! WorkspaceClientAccess::isClient($user, $workspace), 403);
        if ($write) {
            abort_unless(self::canManage($request, $workspace), 403);
        }
        return $workspace;
    }

    public static function canManage(Request $request, Workspace $workspace): bool
    {
        $membership = $workspace->memberships()->where('user_id', $request->user()->id)->first();
        return (int) $workspace->owner_id === (int) $request->user()->id
            || in_array($membership?->role, ['owner', 'admin'], true)
            || (bool) $request->user()->is_admin;
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
