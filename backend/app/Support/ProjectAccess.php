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

        // A stale project membership must not survive revocation at Workspace level.
        if (! $project->workspace->memberships()->where('user_id', $user->id)->exists()) {
            return null;
        }

        $member = $user->memberships()->where('project_id', $project->id)->first();
        $role = $member?->role;
        if ($role === null) {
            return null;
        }
        // A project with a client association does not automatically expose it.
        // Client accounts must belong to the linked company and both switches must be enabled.
        $clientCompanyId = WorkspaceClientAccess::companyId($user, $project->workspace);
        // Client affiliation never confers an internal project role, including
        // when old memberships or pending invitations predate client onboarding.
        if ($clientCompanyId !== null && $role !== 'cliente') return null;
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
            if (! $custom || ! in_array($custom->scope, ['project', 'both'], true) || (int) $custom->workspace_id !== (int) $project->workspace_id) return null;
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
        return BuiltinRolePermissions::has($project->workspace, $role, $permission);
    }

    public static function permissions(User $user, Project $project): array
    {
        return array_values(array_filter(RolePermissions::PROJECT,
            fn (string $permission) => self::has($user, $project, $permission)));
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

    public static function canCreateCards(User $user, Project $project): bool
    {
        return self::has($user, $project, 'cards.create');
    }

    public static function canDeleteCards(User $user, Project $project): bool
    {
        return self::has($user, $project, 'cards.delete');
    }

    public static function canAssignCards(User $user, Project $project): bool
    {
        return self::has($user, $project, 'cards.assign');
    }

    public static function canChangeDates(User $user, Project $project): bool
    {
        return self::has($user, $project, 'cards.dates');
    }

    public static function canChangeState(User $user, Project $project): bool
    {
        return self::has($user, $project, 'cards.state');
    }

    public static function canComment(User $user, Project $project): bool
    {
        return self::has($user, $project, 'cards.comment');
    }

    public static function canManageBoards(User $user, Project $project): bool
    {
        return self::has($user, $project, 'boards.manage');
    }

    public static function canManageMembers(User $user, Project $project): bool
    {
        return self::has($user, $project, 'project.members');
    }

    public static function canUpload(User $user, Project $project): bool
    {
        return self::has($user, $project, 'files.upload');
    }

    public static function canManage(User $user, Project $project): bool
    {
        return self::has($user, $project, 'project.manage');
    }
}
