<?php

namespace App\Http\Controllers\Api;

use App\Models\Workspace;
use App\Support\WorkspacePersonnelGuard;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class WorkspaceSecurityController extends ApiController
{
    public function index(Request $request, Workspace $workspace)
    {
        abort_unless(WorkspacePersonnelGuard::canConfigure($request, $workspace), 403);
        $events = DB::table('workspace_audit_events as event')
            ->leftJoin('users as actor', 'actor.id', '=', 'event.actor_id')
            ->where('event.workspace_id', $workspace->id)
            ->orderByDesc('event.id')->limit(100)
            ->get(['event.id', 'event.action', 'event.details', 'event.created_at', 'actor.name as actor_name'])
            ->map(fn ($event) => [
                'id' => $event->id,
                'action' => $event->action,
                'details' => json_decode($event->details ?? '{}', true),
                'created_at' => $event->created_at,
                'actor_name' => $event->actor_name ?? 'Usuario eliminado',
            ]);
        return response()->json([
            'owner_only_role_management' => true,
            'client_access_enabled' => (bool) $workspace->show_clients,
            'events' => $events,
        ]);
    }
}
