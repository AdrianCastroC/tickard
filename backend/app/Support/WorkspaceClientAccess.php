<?php

namespace App\Support;

use App\Models\User;
use App\Models\Workspace;
use App\Models\WorkspaceMember;

class WorkspaceClientAccess
{
    // The company association belongs to a Workspace, not to the global user identity.
    // The legacy global field is consulted only for matching old Workspace data.
    public static function companyId(User $user, Workspace $workspace): ?int
    {
        $member = WorkspaceMember::where('workspace_id', $workspace->id)
            ->where('user_id', $user->id)->first();
        if (! $member) return null;
        if ($member->client_company_id !== null) return (int) $member->client_company_id;
        if ($user->client_company_id !== null
            && $user->clientCompany?->workspace_id === $workspace->id) {
            return (int) $user->client_company_id;
        }
        return null;
    }

    public static function isClient(User $user, Workspace $workspace): bool
    {
        // An orphaned client membership must never become an internal member
        // simply because its company link was cleared or deleted.
        $membership = WorkspaceMember::where('workspace_id', $workspace->id)
            ->where('user_id', $user->id)->first();
        if ($membership?->role === 'client') return true;

        return self::companyId($user, $workspace) !== null;
    }
}
