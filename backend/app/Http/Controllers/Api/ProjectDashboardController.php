<?php

namespace App\Http\Controllers\Api;

use App\Models\Project;
use App\Models\User;
use App\Support\ProjectAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProjectDashboardController extends ApiController
{
    public function index(Request $request, Project $project)
    {
        $role = ProjectAccess::role($request->user(), $project);
        abort_unless(ProjectAccess::canView($request->user(), $project), 403);
        $client = $role === 'cliente';
        $today = now()->toDateString();

        // All summaries operate on active, visible cards only. Avoid loading
        // complete boards, comments, modules, checklists and attachments.
        $cards = fn () => DB::table('cards')
            ->join('boards', 'boards.id', '=', 'cards.board_id')
            ->join('columns', 'columns.id', '=', 'cards.column_id')
            ->where('boards.project_id', $project->id)
            ->whereNull('cards.archived_at')
            ->when($client, fn ($query) => $query->where('cards.is_internal', false));

        $summary = $cards()->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN columns.workflow_state = 'done' THEN 1 ELSE 0 END) as completed")
            ->selectRaw("SUM(CASE WHEN columns.workflow_state = 'in_progress' THEN 1 ELSE 0 END) as in_progress")
            ->selectRaw("SUM(CASE WHEN columns.workflow_state = 'review' THEN 1 ELSE 0 END) as review")
            ->selectRaw("SUM(CASE WHEN columns.workflow_state = 'pending' THEN 1 ELSE 0 END) as pending")
            ->selectRaw("SUM(CASE WHEN columns.workflow_state = 'backlog' THEN 1 ELSE 0 END) as backlog")
            ->selectRaw("SUM(CASE WHEN cards.due_date < ? AND columns.workflow_state NOT IN ('done','backlog') THEN 1 ELSE 0 END) as overdue", [$today])
            ->selectRaw("MIN(CASE WHEN columns.workflow_state <> 'backlog' THEN COALESCE(cards.start_date,cards.due_date) ELSE NULL END) as start_date")
            ->selectRaw("MAX(CASE WHEN columns.workflow_state <> 'backlog' THEN COALESCE(cards.due_date,cards.start_date) ELSE NULL END) as end_date")
            ->first();

        $columns = $cards()
            ->select('columns.id', 'columns.name', 'columns.color', 'columns.workflow_state',
                'columns.position', 'boards.position as board_position')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('columns.id', 'columns.name', 'columns.color', 'columns.workflow_state',
                'columns.position', 'boards.position')
            // Workflow groups must be contiguous across different boards:
            // Backlog → Por hacer → En progreso → En revisión → Completado.
            // Keep each real column's configured name and color.
            ->orderByRaw("CASE columns.workflow_state WHEN 'backlog' THEN 0 WHEN 'pending' THEN 1 WHEN 'in_progress' THEN 2 WHEN 'review' THEN 3 WHEN 'done' THEN 4 ELSE 5 END")
            ->orderBy('boards.position')->orderBy('columns.position')->orderBy('columns.id')
            ->get();

        // Aggregate same-named columns across boards, preserving first-seen
        // actual names and colors. No hardcoded names from the default workflow.
        $distribution = $columns->groupBy(fn ($column) => $column->workflow_state.'|'.$column->name.'|'.($column->color ?? ''))
            ->map(fn ($group) => [
                'name' => $group->first()->name,
                'color' => $group->first()->color,
                'workflow_state' => $group->first()->workflow_state,
                'total' => $group->sum('total'),
            ])->values();

        $boardStats = $cards()->select('boards.id', 'boards.name', 'boards.position')
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN columns.workflow_state = 'done' THEN 1 ELSE 0 END) as completed")
            ->selectRaw("MIN(CASE WHEN columns.workflow_state <> 'backlog' THEN COALESCE(cards.start_date,cards.due_date) ELSE NULL END) as start_date")
            ->selectRaw("MAX(CASE WHEN columns.workflow_state <> 'backlog' THEN COALESCE(cards.due_date,cards.start_date) ELSE NULL END) as end_date")
            ->groupBy('boards.id', 'boards.name', 'boards.position')
            ->get()->keyBy('id');
        $boards = $project->boards()->get(['id', 'name', 'position'])->map(function ($board) use ($boardStats) {
            $stat = $boardStats->get($board->id);
            return [
                'id' => $board->id,
                'name' => $board->name,
                'position' => $board->position,
                'total' => (int) ($stat?->total ?? 0),
                'completed' => (int) ($stat?->completed ?? 0),
                'start_date' => $stat?->start_date ? substr($stat->start_date, 0, 10) : null,
                'end_date' => $stat?->end_date ? substr($stat->end_date, 0, 10) : null,
            ];
        })->values();

        // Only teams explicitly linked to this project. Count cards assigned
        // to each team (not arbitrary personal assignments of its members).
        // A card shared by two teams can contribute to each team's progress,
        // without changing the project's global total.
        $teams = collect();
        if (! $client) {
            $linkedTeams = DB::table('project_team')
                ->join('teams', 'teams.id', '=', 'project_team.team_id')
                ->where('project_team.project_id', $project->id)
                ->where('teams.workspace_id', $project->workspace_id)
                ->orderBy('teams.name')->orderBy('teams.id')
                ->get(['teams.id', 'teams.name']);

            $teamCounts = $linkedTeams->isEmpty() ? collect() : $cards()
                ->join('card_team', 'card_team.card_id', '=', 'cards.id')
                ->whereIn('card_team.team_id', $linkedTeams->pluck('id'))
                ->select('card_team.team_id')
                ->selectRaw('COUNT(DISTINCT cards.id) as total')
                ->selectRaw("COUNT(DISTINCT CASE WHEN columns.workflow_state = 'done' THEN cards.id END) as completed")
                ->groupBy('card_team.team_id')->get()->keyBy('team_id');

            $teams = $linkedTeams->map(function ($team) use ($teamCounts) {
                $stats = $teamCounts->get($team->id);
                return [
                    'id' => $team->id,
                    'name' => $team->name,
                    'total' => (int) ($stats?->total ?? 0),
                    'completed' => (int) ($stats?->completed ?? 0),
                ];
            })->values();
        }

        // Next milestones and due tasks are limited to small dashboard lists.
        $milestones = $cards()->where('cards.is_milestone', true)
            ->whereNotNull('cards.due_date')
            ->select('cards.id', 'cards.title', 'cards.due_date', 'columns.workflow_state',
                'boards.id as board_id', 'boards.name as board_name')
            ->orderByRaw("CASE WHEN columns.workflow_state = 'done' THEN 1 ELSE 0 END")
            ->orderBy('cards.due_date')->limit(6)->get()
            ->map(fn ($item) => [
                'id' => $item->id, 'title' => $item->title, 'board_id' => $item->board_id,
                'board_name' => $item->board_name, 'state' => $item->workflow_state,
                'due_date' => substr($item->due_date, 0, 10),
            ]);

        // Workspace owners can act as project responsibles without being in
        // project_members; include them in the team metric when appropriate.
        $people = $project->members()->with('user:id,name,avatar_path')
            ->get()->filter(fn ($member) => $member->user !== null)
            ->when($client, fn ($items) => $items->filter(
                fn ($member) => (int) $member->user_id === (int) $request->user()->id
            ))->map(fn ($member) => $member->user)->unique('id');
        if (! $client && ! $people->contains('id', $project->workspace->owner_id)) {
            $owner = User::find($project->workspace->owner_id);
            if ($owner) $people->push($owner);
        }
        if ($client && $people->isEmpty()) {
            $people = collect([$request->user()]);
        }
        $people = $people->values();

        // Never include private comment bodies or activity meta in a dashboard.
        $recent = DB::table('activities')
            ->join('cards', 'cards.id', '=', 'activities.card_id')
            ->join('boards', 'boards.id', '=', 'cards.board_id')
            ->leftJoin('users', 'users.id', '=', 'activities.user_id')
            ->where('boards.project_id', $project->id)
            ->whereNull('cards.archived_at')
            ->when($client, fn ($query) => $query->where('cards.is_internal', false))
            ->select('activities.id', 'activities.type', 'activities.meta', 'activities.created_at',
                'cards.id as card_id', 'cards.title as card_title',
                'boards.id as board_id', 'boards.name as board_name',
                'users.id as user_id', 'users.name as user_name', 'users.avatar_path')
            ->orderByDesc('activities.id')->limit(50)->get()
            ->filter(function ($row) {
                if ($row->type !== 'commented') return true;
                $meta = json_decode($row->meta ?? '{}', true);
                return empty($meta['internal']);
            })->take(6)->map(fn ($row) => [
                'id' => $row->id, 'type' => $row->type, 'created_at' => $row->created_at,
                'card_id' => $row->card_id, 'card_title' => $row->card_title,
                'board_id' => $row->board_id, 'board_name' => $row->board_name,
                'user_id' => $row->user_id,
                'user_name' => $row->user_name ?? 'Sistema',
                'avatar_url' => $row->avatar_path ? '/storage/'.$row->avatar_path : null,
            ])->values();

        return response()->json([
            'summary' => [
                'total' => (int) ($summary->total ?? 0),
                'completed' => (int) ($summary->completed ?? 0),
                'in_progress' => (int) ($summary->in_progress ?? 0),
                'review' => (int) ($summary->review ?? 0),
                'pending' => (int) ($summary->pending ?? 0),
                'backlog' => (int) ($summary->backlog ?? 0),
                'overdue' => (int) ($summary->overdue ?? 0),
                'start_date' => $summary?->start_date ? substr($summary->start_date, 0, 10) : null,
                'end_date' => $summary?->end_date ? substr($summary->end_date, 0, 10) : null,
                'member_count' => $people->count(),
            ],
            'members' => $people->take(5)->map(fn (User $person) => [
                'id' => $person->id, 'name' => $person->name, 'avatar_url' => $person->avatarUrl(),
            ])->values(),
            'columns' => $distribution,
            'boards' => $boards,
            'teams' => $teams,
            'milestones' => $milestones,
            'activity' => $recent,
        ]);
    }
}
