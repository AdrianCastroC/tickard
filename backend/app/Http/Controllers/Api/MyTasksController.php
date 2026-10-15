<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class MyTasksController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'workspace_id' => ['sometimes', 'integer', 'min:1'],
            'project_id' => ['sometimes', 'integer', 'min:1'],
            'state' => ['sometimes', Rule::in(['all', 'backlog', 'pending', 'in_progress', 'review', 'done', 'overdue'])],
            'priority' => ['sometimes', Rule::in(['all', 'baja', 'media', 'alta', 'urgente'])],
            'q' => ['sometimes', 'string', 'max:120'],
            'page' => ['sometimes', 'integer', 'min:1'],
        ]);
        $user = $request->user();
        $today = now()->toDateString();

        // Only explicitly assigned, non-archived Cards in Workspaces the
        // requester currently belongs to. Team assignments do not implicitly
        // assign every team Card to each member.
        $visible = DB::table('card_user')
            ->join('cards', 'cards.id', '=', 'card_user.card_id')
            ->join('columns', 'columns.id', '=', 'cards.column_id')
            ->join('boards', 'boards.id', '=', 'cards.board_id')
            ->join('projects', 'projects.id', '=', 'boards.project_id')
            ->join('workspaces', 'workspaces.id', '=', 'projects.workspace_id')
            ->join('workspace_members', function ($join) use ($user) {
                $join->on('workspace_members.workspace_id', '=', 'workspaces.id')
                    ->where('workspace_members.user_id', '=', $user->id);
            })
            ->leftJoin('project_members', function ($join) use ($user) {
                $join->on('project_members.project_id', '=', 'projects.id')
                    ->where('project_members.user_id', '=', $user->id);
            })
            ->where('card_user.user_id', $user->id)
            ->whereNull('cards.archived_at')
            ->where(function ($query) use ($user) {
                $query->where('workspaces.owner_id', $user->id)
                    ->orWhere(function ($member) {
                        $member->whereNotNull('project_members.user_id')
                            ->where(function ($visibility) {
                                $visibility->where('project_members.role', '!=', 'cliente')
                                    ->orWhere('cards.is_internal', false);
                            });
                    });
                if ($user->is_admin) {
                    // Existing ProjectAccess grants global admins effective
                    // responsibility, but never across Workspaces they left.
                    $query->orWhere('workspace_members.user_id', $user->id);
                }
            });

        // Options always describe the full scope of this user's assignments,
        // even while the list is filtered to another Workspace or project.
        $scopes = (clone $visible)
            ->select('workspaces.id as workspace_id', 'workspaces.name as workspace_name',
                'projects.id as project_id', 'projects.name as project_name')
            ->distinct()->orderBy('workspaces.name')->orderBy('projects.name')->get();

        if (! empty($filters['workspace_id'])) {
            $visible->where('workspaces.id', $filters['workspace_id']);
        }
        if (! empty($filters['project_id'])) {
            $visible->where('projects.id', $filters['project_id']);
        }

        $summaryRows = (clone $visible)
            ->select('columns.workflow_state')
            ->selectRaw('COUNT(*) as total')
            ->selectRaw("SUM(CASE WHEN cards.due_date < ? AND columns.workflow_state NOT IN ('done', 'backlog') THEN 1 ELSE 0 END) as overdue", [$today])
            ->groupBy('columns.workflow_state')->get();

        $summary = ['total' => 0, 'backlog' => 0, 'pending' => 0, 'in_progress' => 0,
            'review' => 0, 'done' => 0, 'overdue' => 0];
        foreach ($summaryRows as $row) {
            $count = (int) $row->total;
            $summary['total'] += $count;
            if (array_key_exists($row->workflow_state, $summary)) {
                $summary[$row->workflow_state] += $count;
            }
            $summary['overdue'] += (int) $row->overdue;
        }

        $tasks = clone $visible;
        $state = $filters['state'] ?? 'all';
        if ($state === 'overdue') {
            $tasks->whereNotNull('cards.due_date')
                ->where('cards.due_date', '<', $today)
                ->whereNotIn('columns.workflow_state', ['done', 'backlog']);
        } elseif ($state !== 'all') {
            $tasks->where('columns.workflow_state', $state);
        }
        $priority = $filters['priority'] ?? 'all';
        if ($priority !== 'all') {
            $tasks->where('cards.priority', $priority);
        }
        $search = trim($filters['q'] ?? '');
        if ($search !== '') {
            $tasks->where(function ($query) use ($search) {
                $value = '%'.addcslashes($search, '%_\\').'%';
                $query->where('cards.title', 'like', $value)
                    ->orWhere('projects.name', 'like', $value)
                    ->orWhere('boards.name', 'like', $value);
            });
        }

        $page = $tasks->select(
            'cards.id', 'cards.title', 'cards.due_date', 'cards.start_date',
            'cards.priority', 'cards.is_milestone', 'cards.updated_at',
            'columns.workflow_state', 'columns.name as column_name',
            'boards.id as board_id', 'boards.name as board_name',
            'projects.id as project_id', 'projects.name as project_name',
            'workspaces.id as workspace_id', 'workspaces.name as workspace_name'
        )
            // Pending dated Cards first, followed by undated and completed.
            ->orderByRaw("CASE WHEN columns.workflow_state = 'done' THEN 2 WHEN cards.due_date IS NULL THEN 1 ELSE 0 END")
            ->orderBy('cards.due_date')
            ->orderByRaw("CASE cards.priority WHEN 'urgente' THEN 0 WHEN 'alta' THEN 1 WHEN 'media' THEN 2 ELSE 3 END")
            ->orderBy('cards.id')
            ->paginate(30, ['*'], 'page', $filters['page'] ?? 1);

        return response()->json([
            'tasks' => $page->getCollection()->map(fn ($row) => [
                'id' => $row->id,
                'title' => $row->title,
                'board_id' => $row->board_id,
                'board_name' => $row->board_name,
                'project_id' => $row->project_id,
                'project_name' => $row->project_name,
                'workspace_id' => $row->workspace_id,
                'workspace_name' => $row->workspace_name,
                'workflow_state' => $row->workflow_state,
                'column_name' => $row->column_name,
                'priority' => $row->priority,
                'start_date' => $row->start_date,
                'due_date' => $row->due_date,
                'is_milestone' => (bool) $row->is_milestone,
                'overdue' => $row->due_date !== null && $row->due_date < $today
                    && ! in_array($row->workflow_state, ['done', 'backlog'], true),
            ])->values(),
            'summary' => $summary,
            'scopes' => $scopes,
            'pagination' => [
                'page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'total' => $page->total(),
                'per_page' => $page->perPage(),
            ],
        ]);
    }
}
