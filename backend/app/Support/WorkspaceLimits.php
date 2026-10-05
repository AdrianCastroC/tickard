<?php

namespace App\Support;

use App\Models\User;
use App\Models\Workspace;

class WorkspaceLimits
{
    public static function maxProjects(Workspace $workspace): ?int
    {
        return match ($workspace->plan) {
            Workspace::PLAN_FREE => 3,
            Workspace::PLAN_BASE => 10,
            Workspace::PLAN_PRO => 50,
            Workspace::PLAN_BUSINESS => $workspace->planLimits?->max_projects,
            default => 3,
        };
    }

    public static function maxMembers(Workspace $workspace): ?int
    {
        return match ($workspace->plan) {
            Workspace::PLAN_FREE,
            Workspace::PLAN_BASE,
            Workspace::PLAN_PRO => null,

            Workspace::PLAN_BUSINESS => $workspace->planLimits?->max_members,

            default => null,
        };
    }

    public static function maxStorageMb(Workspace $workspace): ?int
    {
        return match ($workspace->plan) {
            Workspace::PLAN_FREE,
            Workspace::PLAN_BASE,
            Workspace::PLAN_PRO => null,

            Workspace::PLAN_BUSINESS => $workspace->planLimits?->max_storage_mb,

            default => null,
        };
    }

    public static function canCreateProject(Workspace $workspace): bool
    {
        $limit = self::maxProjects($workspace);

        if ($limit === null) {
            return true;
        }

        return $workspace->projects()->count() < $limit;
    }

    public static function maxOwnedWorkspaces(User $user): ?int
    {
        return match ($user->plan) {
            User::PLAN_FREE => 1,
            User::PLAN_BASE => 5,
            User::PLAN_PRO => null,
            User::PLAN_BUSINESS => null,
            default => 1,
        };
    }

    public static function canCreateWorkspace(User $user): bool
    {
        $limit = self::maxOwnedWorkspaces($user);

        if ($limit === null) {
            return true;
        }

        return $user->ownedWorkspaces()->count() < $limit;
    }
}