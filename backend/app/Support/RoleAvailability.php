<?php

namespace App\Support;

use App\Models\Workspace;
use App\Models\WorkspaceCustomRole;
use Illuminate\Support\Facades\DB;

final class RoleAvailability
{
    public static function builtin(Workspace $workspace, string $key): bool
    {
        if (in_array($key, ['owner', 'cliente', 'client'], true)) return true;
        return (bool) (DB::table('workspace_role_settings')->where('workspace_id', $workspace->id)
            ->where('role_key', $key)->value('enabled') ?? true);
    }

    public static function custom(WorkspaceCustomRole $role, Workspace $workspace, string $scope): bool
    {
        return $role->enabled && (int) $role->workspace_id === (int) $workspace->id
            && in_array($role->scope, [$scope, 'both'], true);
    }
}
