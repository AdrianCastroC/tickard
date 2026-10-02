<?php

namespace App\Support;

use App\Models\Project;
use App\Models\User;

class ProjectAccess
{
    public static function role(User $user, Project $project): ?string
    {
        if ($user->is_admin) {
            return 'responsable';
        }

        return $user->memberships()->where('project_id', $project->id)->value('role');
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
