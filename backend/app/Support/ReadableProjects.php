<?php

namespace App\Support;

use App\Models\Project;
use App\Models\User;
use App\Models\Workspace;

final class ReadableProjects
{
    /**
     * Effective read scope for cross-project dashboards. An assignment or
     * Workspace membership never overrides disabled client access, a revoked
     * built-in role, or a custom role without project.view.
     *
     * Resolve one scope per HTTP request, not one authorization per Card.
     */
    public static function ids(User $user, ?Workspace $workspace = null): array
    {
        return Project::query()
            ->whereHas('workspace.memberships', fn ($query) => $query->where('user_id', $user->id))
            ->when($workspace !== null, fn ($query) => $query->where('workspace_id', $workspace->id))
            ->when(! $user->is_admin, fn ($query) => $query->where(function ($visible) use ($user) {
                $visible->whereHas('workspace', fn ($owned) => $owned->where('owner_id', $user->id))
                    ->orWhereHas('members', fn ($members) => $members->where('user_id', $user->id));
            }))
            ->with('workspace')
            ->get()
            ->filter(fn (Project $project) => ProjectAccess::canView($user, $project))
            ->pluck('id')->map(fn ($id) => (int) $id)->all();
    }
}
