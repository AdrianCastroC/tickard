<?php

namespace App\Http\Controllers\Api;

use App\Models\Board;
use App\Support\ProjectAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class BoardDashboardController extends ApiController
{
    /**
     * Small, board-scoped summaries. Never hydrate complete Card payloads.
     * This endpoint uses the same project access and client visibility rules
     * as the Kanban and project dashboard views.
     */
    public function index(Request $request, Board $board)
    {
        $project = $board->project;
        $role = ProjectAccess::role($request->user(), $project);
        abort_unless(ProjectAccess::canView($request->user(), $project), 403);
        $client = $role === 'cliente';
        $today = now()->toDateString();

        $cards = fn () => DB::table('cards')
            ->join('columns', 'columns.id', '=', 'cards.column_id')
            ->where('cards.board_id', $board->id)
            ->whereNull('cards.archived_at')
            ->when($client, fn ($query) => $query->where('cards.is_internal', false));

        $stats = $cards()
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN columns.workflow_state = 'done' THEN 1 ELSE 0 END) as completed")
            ->selectRaw("SUM(CASE WHEN columns.workflow_state = 'in_progress' THEN 1 ELSE 0 END) as in_progress")
            ->selectRaw("SUM(CASE WHEN columns.workflow_state = 'review' THEN 1 ELSE 0 END) as review")
            ->selectRaw("SUM(CASE WHEN columns.workflow_state = 'pending' THEN 1 ELSE 0 END) as pending")
            ->selectRaw("SUM(CASE WHEN columns.workflow_state = 'backlog' THEN 1 ELSE 0 END) as backlog")
            ->selectRaw("SUM(CASE WHEN cards.due_date < ? AND columns.workflow_state NOT IN ('done','backlog') THEN 1 ELSE 0 END) as overdue", [$today])
            ->selectRaw("SUM(CASE WHEN cards.due_date IS NOT NULL AND columns.workflow_state <> 'backlog' THEN 1 ELSE 0 END) as with_date")
            ->selectRaw("SUM(CASE WHEN cards.due_date IS NULL AND columns.workflow_state <> 'backlog' THEN 1 ELSE 0 END) as without_date")
            ->selectRaw("MIN(CASE WHEN columns.workflow_state <> 'backlog' THEN COALESCE(cards.start_date,cards.due_date) ELSE NULL END) as start_date")
            ->selectRaw("MAX(CASE WHEN columns.workflow_state <> 'backlog' THEN COALESCE(cards.due_date,cards.start_date) ELSE NULL END) as end_date")
            ->first();

        $columnCounts = $cards()->select('cards.column_id')
            ->selectRaw('COUNT(*) as total')
            ->groupBy('cards.column_id')
            ->get()->keyBy('column_id');

        // Include the real empty columns and preserve the configured names,
        // positions and colors, not only those with active Cards.
        $columns = $board->columns()->orderBy('position')->get([
            'id', 'name', 'workflow_state', 'color', 'position',
        ])->map(fn ($column) => [
            'id' => $column->id,
            'name' => $column->name,
            'workflow_state' => $column->workflow_state,
            'color' => $column->color,
            'total' => (int) ($columnCounts->get($column->id)?->total ?? 0),
        ])->values();

        $deadlines = $cards()
            ->whereNotIn('columns.workflow_state', ['done', 'backlog'])
            ->whereNotNull('cards.due_date')
            ->select('cards.id', 'cards.title', 'cards.due_date', 'cards.priority', 'columns.workflow_state')
            ->orderBy('cards.due_date')->orderBy('cards.id')->limit(7)->get()
            ->map(fn ($card) => [
                'id' => $card->id,
                'title' => $card->title,
                'due_date' => substr($card->due_date, 0, 10),
                'state' => $card->workflow_state,
                'priority' => $card->priority,
            ])->values();

        $milestones = $cards()
            ->where('cards.is_milestone', true)
            ->whereNotNull('cards.due_date')
            ->select('cards.id', 'cards.title', 'cards.due_date', 'cards.priority', 'columns.workflow_state')
            ->orderByRaw("CASE WHEN columns.workflow_state = 'done' THEN 1 ELSE 0 END")
            ->orderBy('cards.due_date')->orderBy('cards.id')->limit(5)->get()
            ->map(fn ($card) => [
                'id' => $card->id,
                'title' => $card->title,
                'due_date' => substr($card->due_date, 0, 10),
                'state' => $card->workflow_state,
            ])->values();

        // A blocked task has at least one unfinished predecessor, potentially
        // in another board. Don't disclose dependency aggregates to clients.
        $blocked = $client ? 0 : $cards()
            ->whereNotIn('columns.workflow_state', ['backlog', 'done'])
            ->whereExists(function ($exists) {
                $exists->selectRaw('1')
                    ->from('card_dependencies')
                    ->join('cards as predecessors', 'predecessors.id', '=', 'card_dependencies.predecessor_card_id')
                    ->join('columns as predecessor_columns', 'predecessor_columns.id', '=', 'predecessors.column_id')
                    ->whereColumn('card_dependencies.successor_card_id', 'cards.id')
                    ->whereNull('predecessors.archived_at')
                    ->where('predecessor_columns.workflow_state', '<>', 'done');
            })->count();

        $priorityCounts = $cards()
            ->select('cards.priority')->selectRaw('COUNT(*) as total')
            ->groupBy('cards.priority')->get()->map(fn ($item) => [
                'priority' => $item->priority ?: 'sin_prioridad',
                'total' => (int) $item->total,
            ])->values();

        $labels = $cards()
            ->join('card_label', 'card_label.card_id', '=', 'cards.id')
            ->join('labels', function ($join) use ($project) {
                $join->on('labels.id', '=', 'card_label.label_id')
                    ->where('labels.project_id', '=', $project->id);
            })
            ->select('labels.id', 'labels.name', 'labels.tone')
            ->selectRaw('COUNT(DISTINCT cards.id) as total')
            ->groupBy('labels.id', 'labels.name', 'labels.tone')
            ->orderByDesc('total')->orderBy('labels.name')->limit(8)->get()
            ->map(fn ($item) => [
                'id' => $item->id, 'name' => $item->name,
                'tone' => $item->tone, 'total' => (int) $item->total,
            ])->values();

        $files = DB::table('card_attachments')
            ->join('cards', 'cards.id', '=', 'card_attachments.card_id')
            ->where('cards.board_id', $board->id)
            ->whereNull('cards.archived_at')
            ->when($client, fn ($query) => $query->where('cards.is_internal', false))
            ->orderByDesc('card_attachments.created_at')
            ->orderByDesc('card_attachments.id')
            ->limit(5)
            ->get(['card_attachments.id', 'card_attachments.original_name',
                'card_attachments.mime_type', 'card_attachments.created_at',
                'cards.id as card_id', 'cards.title as card_title'])
            ->map(fn ($file) => [
                'id' => $file->id,
                'name' => $file->original_name,
                'mime_type' => $file->mime_type,
                'created_at' => $file->created_at,
                'card_id' => $file->card_id,
                'card_title' => $file->card_title,
            ])->values();

        $members = collect();
        if (! $client || $project->show_assignee) {
            $members = $cards()
                ->join('card_user', 'card_user.card_id', '=', 'cards.id')
                ->join('users', 'users.id', '=', 'card_user.user_id')
                ->select('users.id', 'users.name', 'users.avatar_path')
                ->selectRaw('COUNT(DISTINCT cards.id) as total')
                ->groupBy('users.id', 'users.name', 'users.avatar_path')
                ->orderByDesc('total')->orderBy('users.name')->get();
        }

        // Activity is scoped to the same visible, non-archived Cards.
        // Do not send comment bodies or private activity metadata.
        $activity = DB::table('activities')
            ->join('cards', 'cards.id', '=', 'activities.card_id')
            ->leftJoin('users', 'users.id', '=', 'activities.user_id')
            ->where('cards.board_id', $board->id)
            ->whereNull('cards.archived_at')
            ->when($client, fn ($query) => $query->where('cards.is_internal', false))
            ->select('activities.id', 'activities.type', 'activities.meta', 'activities.created_at',
                'cards.id as card_id', 'cards.title as card_title',
                'users.id as user_id', 'users.name as user_name', 'users.avatar_path')
            ->orderByDesc('activities.id')->limit(50)->get()
            ->filter(function ($entry) {
                if ($entry->type !== 'commented') return true;
                $meta = json_decode($entry->meta ?? '{}', true);
                return empty($meta['internal']);
            })->take(6)->map(fn ($entry) => [
                'id' => $entry->id,
                'type' => $entry->type,
                'created_at' => $entry->created_at,
                'card_id' => $entry->card_id,
                'card_title' => $entry->card_title,
                'user_id' => $entry->user_id,
                'user_name' => $entry->user_name ?? 'Sistema',
                'avatar_url' => $entry->avatar_path ? '/storage/'.$entry->avatar_path : null,
            ])->values();

        return response()->json([
            'summary' => [
                'total' => (int) ($stats->total ?? 0),
                'completed' => (int) ($stats->completed ?? 0),
                'pending' => (int) ($stats->pending ?? 0),
                'in_progress' => (int) ($stats->in_progress ?? 0),
                'review' => (int) ($stats->review ?? 0),
                'backlog' => (int) ($stats->backlog ?? 0),
                'overdue' => (int) ($stats->overdue ?? 0),
                'with_date' => (int) ($stats->with_date ?? 0),
                'without_date' => (int) ($stats->without_date ?? 0),
                'blocked' => $blocked,
                'start_date' => $stats?->start_date ? substr($stats->start_date, 0, 10) : null,
                'end_date' => $stats?->end_date ? substr($stats->end_date, 0, 10) : null,
                'member_count' => $members->count(),
            ],
            'columns' => $columns,
            'deadlines' => $deadlines,
            'priorities' => $priorityCounts,
            'labels' => $labels,
            'files' => $files,
            'milestones' => $milestones,
            'members' => $members->take(6)->map(fn ($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'avatar_url' => $user->avatar_path ? '/storage/'.$user->avatar_path : null,
                'total' => (int) $user->total,
            ])->values(),
            'activity' => $activity,
        ]);
    }
}
