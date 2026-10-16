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

        $role = $user->memberships()->where('project_id', $project->id)->value('role');
        if ($role === null) {
            return null;
        }
        // A project with a client association does not automatically expose it.
        // Client accounts must belong to the linked company and both switches must be enabled.
        if ($role === 'cliente' || $user->client_company_id !== null) {
            if (! $project->client_access_enabled || ! $project->workspace->show_clients
                || $user->email_verified_at === null
                || ! $project->workspace->memberships()->where('user_id', $user->id)->exists()
                || $project->client_company_id === null
                || (int) $user->client_company_id !== (int) $project->client_company_id) {
                return null;
            }
        }
        return $role;
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
