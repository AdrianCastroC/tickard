<?php

namespace App\Support;

use App\Models\Workspace;
use App\Models\User;
use Illuminate\Support\Facades\DB;

final class WorkspaceAudit
{
    public static function record(Workspace $workspace, ?User $actor, string $action, array $details = []): void
    {
        DB::table('workspace_audit_events')->insert([
            'workspace_id' => $workspace->id,
            'actor_id' => $actor?->id,
            'action' => $action,
            'details' => json_encode($details),
            'created_at' => now(),
        ]);
    }
}
