<?php

namespace App\Support;

final class RolePermissions
{
    public const PROJECT = [
        'project.view', 'project.manage', 'project.delete', 'project.members',
        'boards.manage', 'cards.edit', 'cards.comment', 'files.upload',
    ];
    public const WORKSPACE = [
        'workspace.view', 'workspace.manage', 'workspace.members',
        'workspace.projects', 'workspace.clients', 'workspace.teams',
        'workspace.departments',
    ];

    public static function allowed(string $scope): array
    {
        return $scope === 'project' ? self::PROJECT : self::WORKSPACE;
    }

    public static function defaults(string $scope): array
    {
        return $scope === 'project' ? ['project.view', 'cards.comment'] : ['workspace.view'];
    }
}
