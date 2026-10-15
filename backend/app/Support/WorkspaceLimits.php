<?php

namespace App\Support;

use App\Models\User;
use App\Models\Workspace;

class WorkspaceLimits
{
    public static function maxProjects(Workspace $workspace): ?int
    {
        return match ($workspace->effectivePlan()) {
            User::PLAN_FREE => 3,
            User::PLAN_BASE => 10,
            User::PLAN_PRO => 50,
            User::PLAN_BUSINESS => $workspace->planLimits?->max_projects,
            default => 3,
        };
    }

    public static function maxMembers(Workspace $workspace): ?int
    {
        $included = match ($workspace->effectivePlan()) {
            User::PLAN_FREE => 3,
            User::PLAN_BASE => 10,
            User::PLAN_PRO => 30,
            User::PLAN_BUSINESS => $workspace->planLimits?->max_members,
            default => 3,
        };

        return $included === null ? null : $included + $workspace->extra_seats;
    }

    public static function maxStorageMb(Workspace $workspace): ?int
    {
        return match ($workspace->effectivePlan()) {
            User::PLAN_BUSINESS => $workspace->planLimits?->max_storage_mb,
            default => null,
        };
    }

    public static function canCreateProject(Workspace $workspace): bool
    {
        $limit = self::maxProjects($workspace);

        return $limit === null || $workspace->projects()->count() < $limit;
    }

    public static function canAddMember(Workspace $workspace): bool
    {
        $limit = self::maxMembers($workspace);

        return $limit === null || $workspace->memberships()->count() < $limit;
    }

    public static function maxOwnedWorkspaces(User $user): ?int
    {
        return match ($user->plan) {
            User::PLAN_FREE => 1,
            User::PLAN_BASE => 5,
            User::PLAN_PRO, User::PLAN_BUSINESS => null,
            default => 1,
        };
    }

    public static function canCreateWorkspace(User $user): bool
    {
        $limit = self::maxOwnedWorkspaces($user);

        return $limit === null || $user->ownedWorkspaces()->count() < $limit;
    }
}
