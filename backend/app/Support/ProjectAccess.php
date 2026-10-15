<?php

namespace App\Support;

use App\Models\Project;
use App\Models\User;

class ProjectAccess
{
    public static function role(User $user, Project $project): ?string
    {
        // Workspace ownership is independent of project membership.
        // Keep the existing project-role contract for consumers: the owner has
        // the effective permissions of a responsible on every owned project.
        if ($user->is_admin || self::isWorkspaceOwner($user, $project)) {
            return 'responsable';
        }

        return $user->memberships()->where('project_id', $project->id)->value('role');
    }

    public static function isWorkspaceOwner(User $user, Project $project): bool
    {
        if (! $project->workspace_id) {
            return false;
        }

        return (int) $project->workspace->owner_id === (int) $user->id;
    }

    public static function canView(User $user, Project $project): bool
    {
        return self::role($user, $project) !== null;
    }

    public static function canEditCards(User $user, Project $project): bool
    {
        return in_array(self::role($user, $project), ['responsable', 'editor'], true);
    }

    public static function canComment(User $user, Project $project): bool
    {
        return self::role($user, $project) !== null;
    }

    public static function canManage(User $user, Project $project): bool
    {
        return self::role($user, $project) === 'responsable';
    }
}
