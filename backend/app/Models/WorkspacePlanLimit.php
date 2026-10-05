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

        if ($included === null) {
            return null;
        }

        return $included + $workspace->extra_seats;
    }

    public static function maxStorageMb(Workspace $workspace): ?int
    {
        return match ($workspace->effectivePlan()) {
            User::PLAN_FREE,
            User::PLAN_BASE,
            User::PLAN_PRO => null,

            User::PLAN_BUSINESS => $workspace->planLimits?->max_storage_mb,

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

    public static function canAddMember(Workspace $workspace): bool
    {
        $limit = self::maxMembers($workspace);

        if ($limit === null) {
            return true;
        }

        return $workspace->members()->count() < $limit;
    }
}