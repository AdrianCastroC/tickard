<?php

namespace App\Support;

use App\Models\Project;
use App\Models\User;
use App\Support\WorkspaceClientAccess;

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

        $member = $user->memberships()->where('project_id', $project->id)->first();
        $role = $member?->role;
        if ($role === null) {
            return null;
        }
        // A project with a client association does not automatically expose it.
        // Client accounts must belong to the linked company and both switches must be enabled.
        $clientCompanyId = WorkspaceClientAccess::companyId($user, $project->workspace);
        if ($role === 'cliente' || $clientCompanyId !== null) {
            if (! $project->client_access_enabled || ! $project->workspace->show_clients
                || $user->email_verified_at === null
                || ! $project->workspace->memberships()->where('user_id', $user->id)->exists()
                || $project->client_company_id === null
                || $clientCompanyId === null
                || $clientCompanyId !== (int) $project->client_company_id) {
                return null;
            }
        }
        if ($member?->custom_role_id !== null) {
            $custom = $member->customRole;
            if (! $custom || $custom->scope !== 'project' || (int) $custom->workspace_id !== (int) $project->workspace_id) return null;
        }
        return $role;
    }

    public static function has(User $user, Project $project, string $permission): bool
    {
        $role = self::role($user, $project);
        if ($role === null) return false;
        if ($role === 'responsable' && ($user->is_admin || self::isWorkspaceOwner($user, $project))) return true;
        $member = $user->memberships()->where('project_id', $project->id)->first();
        if ($member?->custom_role_id !== null) {
            return in_array($permission, $member->customRole?->permissions ?? [], true);
        }
        return match ($permission) {
            'project.view' => true,
            'project.manage', 'project.members', 'boards.manage' => $role === 'responsable',
            'cards.edit', 'files.upload' => in_array($role, ['responsable', 'editor'], true),
            'cards.comment' => true,
            default => false,
        };
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
        return self::has($user, $project, 'project.view');
    }

    public static function canEditCards(User $user, Project $project): bool
    {
        return self::has($user, $project, 'cards.edit');
    }

    public static function canComment(User $user, Project $project): bool
    {
        return self::has($user, $project, 'cards.comment');
    }

    public static function canManage(User $user, Project $project): bool
    {
        return self::has($user, $project, 'project.manage');
    }
}
