<?php

namespace App\Support;

use App\Models\Workspace;
use Illuminate\Support\Facades\DB;

final class BuiltinRolePermissions
{
    private const DEFAULTS = [
        'admin' => ['workspace.view', 'workspace.members', 'workspace.projects',
            'workspace.clients', 'workspace.teams', 'workspace.departments'],
        'member' => ['workspace.view'],
        'responsable' => RolePermissions::PROJECT,
        'editor' => ['project.view', 'cards.edit', 'cards.create', 'cards.delete',
            'cards.assign', 'cards.dates', 'cards.state', 'cards.comment', 'files.upload'],
        'lector' => ['project.view', 'cards.comment'],
        'cliente' => ['project.view', 'cards.comment'],
    ];

    public static function defaults(string $key): array
    {
        return self::DEFAULTS[$key] ?? [];
    }

    public static function get(Workspace $workspace, string $key): array
    {
        if ($key === 'owner') {
            return RolePermissions::WORKSPACE;
        }
        $stored = DB::table('workspace_role_settings')
            ->where('workspace_id', $workspace->id)->where('role_key', $key)
            ->value('permissions');
        if ($stored === null) return self::defaults($key);
        $decoded = json_decode($stored, true);
        return is_array($decoded) ? $decoded : self::defaults($key);
    }

    public static function has(Workspace $workspace, string $key, string $permission): bool
    {
        return in_array($permission, self::get($workspace, $key), true);
    }
}
