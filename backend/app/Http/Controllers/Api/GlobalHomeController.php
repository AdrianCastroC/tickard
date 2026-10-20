<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Support\ReadableProjects;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class GlobalHomeController extends Controller
{
    public function projects(Request $request)
    {
        $user = $request->user();
        $readableProjectIds = ReadableProjects::ids($user);

        // Workspace membership alone must not reveal another project's name.
        // Owner and global administrator privileges mirror ProjectAccess.
        $projects = DB::table('projects')
            ->whereIn('projects.id', $readableProjectIds)
            ->join('workspaces', 'workspaces.id', '=', 'projects.workspace_id')
            ->join('workspace_members', function ($join) use ($user) {
                $join->on('workspace_members.workspace_id', '=', 'workspaces.id')
                    ->where('workspace_members.user_id', '=', $user->id);
            })
            ->leftJoin('project_members', function ($join) use ($user) {
                $join->on('project_members.project_id', '=', 'projects.id')
                    ->where('project_members.user_id', '=', $user->id);
            })
            ->where(function ($query) use ($user) {
                $query->where('workspaces.owner_id', $user->id)
                    ->orWhereNotNull('project_members.user_id');
                if ($user->is_admin) {
                    $query->orWhere('workspace_members.user_id', $user->id);
                }
            })
            ->select(
                'projects.id', 'projects.name', 'projects.workspace_id',
                'workspaces.name as workspace_name',
                'workspaces.owner_id',
                'project_members.role as assigned_role'
            )
            ->orderBy('workspaces.name')
            ->orderBy('projects.name')
            ->orderBy('projects.id')
            ->limit(101)
            ->get();

        $hasMore = $projects->count() > 100;
        $projects = $projects->take(100);
        $ids = $projects->pluck('id')->all();
        $clientIds = $projects->filter(fn ($project) =>
            ! $user->is_admin && (int) $project->owner_id !== (int) $user->id
            && $project->assigned_role === 'cliente'
        )->pluck('id')->all();

        // Count actual visible Cards (no archived Cards, no internal client
        // Cards). The bar represents completed Cards / visible Cards.
        $cardTotals = empty($ids) ? collect() : DB::table('cards')
            ->join('boards', 'boards.id', '=', 'cards.board_id')
            ->join('columns', 'columns.id', '=', 'cards.column_id')
            ->whereIn('boards.project_id', $ids)
            ->whereNull('cards.archived_at')
            ->when(! empty($clientIds), fn ($query) =>
                $query->where(fn ($visible) =>
                    $visible->whereNotIn('boards.project_id', $clientIds)
                        ->orWhere('cards.is_internal', false)
                )
            )
            ->select('boards.project_id')
            ->selectRaw('COUNT(*) as card_count')
            ->selectRaw('SUM(CASE WHEN columns.workflow_state = ? THEN 1 ELSE 0 END) as completed_count', ['done'])
            ->groupBy('boards.project_id')
            ->get()->keyBy('project_id');

        $boardTotals = empty($ids) ? collect() : DB::table('boards')
            ->whereIn('project_id', $ids)
            ->select('project_id')->selectRaw('COUNT(*) as total')
            ->groupBy('project_id')->get()->keyBy('project_id');

        return response()->json([
            'projects' => $projects->map(function ($project) use ($user, $cardTotals, $boardTotals) {
                $cards = $cardTotals->get($project->id);
                return [
                    'id' => (int) $project->id,
                    'name' => $project->name,
                    'workspace_id' => (int) $project->workspace_id,
                    'workspace_name' => $project->workspace_name,
                    'role' => $user->is_admin || (int) $project->owner_id === (int) $user->id
                        ? 'responsable' : $project->assigned_role,
                    'board_count' => (int) ($boardTotals->get($project->id)?->total ?? 0),
                    'card_count' => (int) ($cards?->card_count ?? 0),
                    'completed_count' => (int) ($cards?->completed_count ?? 0),
                ];
            })->values(),
            'has_more' => $hasMore,
        ]);
    }
}
