<?php

namespace App\Http\Controllers\Api;

use App\Models\Project;
use App\Models\User;
use App\Support\ProjectAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProjectBoardsOverviewController extends ApiController
{
    public function index(Request $request, Project $project)
    {
        $role = ProjectAccess::role($request->user(), $project);
        abort_unless($role !== null, 403);
        $client = $role === 'cliente';

        // Keep the overview light: aggregate in SQL instead of hydrating Cards,
        // checklists, attachments and activities from every board.
        $visibleCards = fn () => DB::table('cards')
            ->join('boards', 'boards.id', '=', 'cards.board_id')
            ->join('columns', 'columns.id', '=', 'cards.column_id')
            ->where('boards.project_id', $project->id)
            ->whereNull('cards.archived_at')
            ->when($client, fn ($query) => $query->where('cards.is_internal', false));

        $columnCounts = $visibleCards()
            ->select('cards.board_id', 'cards.column_id')
            ->selectRaw('COUNT(*) as task_count')
            ->groupBy('cards.board_id', 'cards.column_id')
            ->get()->keyBy(fn ($row) => $row->board_id.':'.$row->column_id);

        $today = now()->toDateString();
        $totals = $visibleCards()
            ->select('cards.board_id')
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN columns.workflow_state = 'done' THEN 1 ELSE 0 END) as completed")
            ->selectRaw("SUM(CASE WHEN cards.due_date < ? AND columns.workflow_state NOT IN ('done', 'backlog') THEN 1 ELSE 0 END) as overdue", [$today])
            ->selectRaw("MIN(CASE WHEN columns.workflow_state <> 'backlog' THEN COALESCE(cards.start_date, cards.due_date) ELSE NULL END) as start_date")
            ->selectRaw("MAX(CASE WHEN columns.workflow_state <> 'backlog' THEN COALESCE(cards.due_date, cards.start_date) ELSE NULL END) as end_date")
            ->selectRaw('MAX(cards.updated_at) as last_card_update')
            ->groupBy('cards.board_id')
            ->get()->keyBy('board_id');

        $columns = DB::table('columns')->join('boards', 'boards.id', '=', 'columns.board_id')
            ->where('boards.project_id', $project->id)
            ->select('columns.id', 'columns.board_id', 'columns.name', 'columns.color',
                'columns.workflow_state', 'columns.position')
            ->orderBy('boards.position')->orderBy('columns.position')->orderBy('columns.id')
            ->get()->groupBy('board_id');

        // Never include users assigned exclusively to internal Cards in client responses.
        $assignmentRows = DB::table('card_user')
            ->join('cards', 'cards.id', '=', 'card_user.card_id')
            ->join('boards', 'boards.id', '=', 'cards.board_id')
            ->where('boards.project_id', $project->id)
            ->whereNull('cards.archived_at')
            ->when($client, fn ($query) => $query->where('cards.is_internal', false))
            ->select('cards.board_id', 'card_user.user_id')
            ->distinct()
            ->orderBy('cards.board_id')->orderBy('card_user.user_id')
            ->get()->groupBy('board_id');
        $users = User::query()->whereIn('id', $assignmentRows->flatten()->pluck('user_id')->unique())
            ->get(['id', 'name', 'avatar_path'])->keyBy('id');

        return response()->json([
            'can_manage' => ProjectAccess::canManage($request->user(), $project),
            'boards' => $project->boards()->get(['id', 'name', 'position', 'updated_at'])
                ->map(function ($board) use ($columns, $columnCounts, $totals, $assignmentRows, $users) {
                    $stats = $totals->get($board->id);
                    $assigned = $assignmentRows->get($board->id, collect())
                        ->pluck('user_id')->unique()->filter(fn ($id) => $users->has($id))->values();
                    $lastUpdate = $stats?->last_card_update;
                    if ($board->updated_at && (! $lastUpdate || $board->updated_at->toDateTimeString() > $lastUpdate)) {
                        $lastUpdate = $board->updated_at->toDateTimeString();
                    }

                    return [
                        'id' => $board->id,
                        'name' => $board->name,
                        'position' => $board->position,
                        'total' => (int) ($stats?->total ?? 0),
                        'completed' => (int) ($stats?->completed ?? 0),
                        'overdue' => (int) ($stats?->overdue ?? 0),
                        'start_date' => $stats?->start_date,
                        'end_date' => $stats?->end_date,
                        'updated_at' => $lastUpdate,
                        'member_count' => $assigned->count(),
                        'members' => $assigned->take(4)->map(function ($id) use ($users) {
                            $user = $users->get($id);
                            return ['id' => $user->id, 'name' => $user->name, 'avatar_url' => $user->avatarUrl()];
                        })->values(),
                        'columns' => $columns->get($board->id, collect())->map(fn ($column) => [
                            'id' => $column->id,
                            'name' => $column->name,
                            'color' => $column->color,
                            'workflow_state' => $column->workflow_state,
                            'position' => $column->position,
                            'count' => (int) ($columnCounts->get($board->id.':'.$column->id)?->task_count ?? 0),
                        ])->values(),
                    ];
                })->values(),
        ]);
    }
}
