<?php

namespace App\Http\Controllers\Api;

use App\Models\Board;
use App\Models\BoardCategory;
use App\Models\Card;
use App\Models\Column;
use App\Models\Label;
use App\Models\User;
use App\Support\Notifier;
use App\Support\CardDependencyService;
use App\Support\CardBacklogService;
use App\Support\MilestoneCompletionService;
use App\Support\ProjectAccess;
use App\Support\ProjectFileStorage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class CardsController extends ApiController
{
    public function storeColumn(Request $request, Board $board)
    {
        abort_unless(ProjectAccess::canManageBoards($request->user(), $board->project), 403);
        $data = $request->validate(['name' => ['required', 'string', 'max:80']]);
        $position = ((int) $board->columns()->max('position')) + 1;
        $column = $board->columns()->create([
            'name' => $data['name'],
            'position' => $position,
            'workflow_state' => 'pending',
        ]);
        $board->touchRevision();

        return response()->json([
            'id' => $column->id,
            'name' => $column->name,
            'position' => $column->position,
            'workflow_state' => $column->workflow_state,
        ], 201);
    }

    public function updateColumn(Request $request, Column $column, CardDependencyService $dependencies, MilestoneCompletionService $milestones)
    {
        abort_unless(ProjectAccess::canManageBoards($request->user(), $column->board->project), 403);
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:80'],
            'color' => ['sometimes', 'nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'workflow_state' => ['sometimes', Rule::in(['backlog', 'pending', 'in_progress', 'review', 'done'])],
        ]);
        abort_unless($data !== [], 422);
        $board = $column->board;

        if (($data['workflow_state'] ?? $column->workflow_state) === 'backlog'
            && $column->workflow_state !== 'backlog'
            && $column->cards()->whereNull('archived_at')->where('is_milestone', true)->exists()) {
            throw ValidationException::withMessages(['workflow_state' => 'La columna contiene hitos. Muévelos antes de convertirla en Backlog.']);
        }
        if (($data['workflow_state'] ?? null) === 'backlog' && $column->workflow_state !== 'backlog') {
            $hasDependencies = $column->cards()->whereNull('archived_at')->where(function ($query) {
                $query->whereHas('predecessorDependencies')->orWhereHas('successorDependencies');
            })->exists();
            if ($hasDependencies) {
                throw ValidationException::withMessages(['workflow_state' => 'La columna contiene Cards con dependencias. Resuélvelas antes de convertirla en Backlog.']);
            }
        }

        if (
            $column->workflow_state === 'backlog'
            && ($data['workflow_state'] ?? null) !== null
            && $data['workflow_state'] !== 'backlog'
            && $board->columns()->where('workflow_state', 'backlog')->count() === 1
        ) {
            throw ValidationException::withMessages([
                'workflow_state' => 'El Board debe conservar al menos una columna Backlog.',
            ]);
        }

        $affectedBoardIds = [$board->id];
        $previousWorkflowState = $column->workflow_state;

        DB::transaction(function () use ($column, $data, $board, $dependencies, &$affectedBoardIds) {
            $workflowStateChanged = array_key_exists('workflow_state', $data)
                && $data['workflow_state'] !== $column->workflow_state;

            $column->update($data);

            if ($workflowStateChanged) {
                $column->cards()
                    ->whereNull('archived_at')
                    ->get()
                    ->each(function (Card $card) use ($column, $dependencies, &$affectedBoardIds): void {
                        $affectedBoardIds = array_merge(
                            $affectedBoardIds,
                            $this->applyWorkflowState($card, $column->workflow_state, $dependencies)
                        );
                    });
            }
        });
        $this->touchBoards($affectedBoardIds);
        if ($previousWorkflowState !== 'done' && $column->workflow_state === 'done') {
            $column->cards()->whereNull('archived_at')->get()
                ->each(fn (Card $card) => $milestones->evaluateSuccessors($card, $request->user()->id));
        }

        return response()->json([
            'id' => $column->id,
            'name' => $column->name,
            'color' => $column->color,
            'position' => $column->position,
            'workflow_state' => $column->workflow_state,
        ]);
    }

    public function moveColumn(Request $request, Column $column)
    {
        abort_unless(ProjectAccess::canManageBoards($request->user(), $column->board->project), 403);
        $data = $request->validate(['position' => ['required', 'integer', 'min:0']]);
        $board = $column->board;

        DB::transaction(function () use ($board, $column, $data) {
            $columns = $board->columns()->where('id', '!=', $column->id)->orderBy('position')->get();
            $position = max(1, min($data['position'], $columns->count() + 1));
            $columns->splice($position, 0, [$column]);
            foreach ($columns as $index => $item) {
                $item->position = $index;
                $item->save();
            }
            $board->touchRevision();
        });

        return response()->noContent();
    }

    public function destroyColumn(Request $request, Column $column)
    {
        abort_unless(ProjectAccess::canManageBoards($request->user(), $column->board->project), 403);

        if (
            $column->workflow_state === 'backlog'
            && $column->board->columns()->where('workflow_state', 'backlog')->count() === 1
        ) {
            throw ValidationException::withMessages([
                'column' => 'El Board debe conservar al menos una columna Backlog.',
            ]);
        }

        if ($column->cards()->whereNull('archived_at')->exists()) {
            throw ValidationException::withMessages([
                'column' => 'Vacía la columna antes de borrarla.',
            ]);
        }

        $board = $column->board;
        $paths = ProjectFileStorage::pathsForColumn($column);
        $column->delete();
        ProjectFileStorage::purgePaths($paths);
        $board->touchRevision();

        return response()->noContent();
    }

    public function storeCategory(Request $request, Board $board)
    {
        abort_unless(ProjectAccess::canManageBoards($request->user(), $board->project), 403);
        $data = $request->validate(['name' => ['required', 'string', 'max:80']]);
        $position = ((int) $board->categories()->max('position')) + 1;
        $category = $board->categories()->create([
            'name' => $data['name'],
            'position' => $position,
        ]);
        $board->touchRevision();

        return response()->json([
            'id' => $category->id,
            'name' => $category->name,
            'position' => $category->position,
        ], 201);
    }

    public function updateCategory(Request $request, BoardCategory $category)
    {
        abort_unless(ProjectAccess::canManageBoards($request->user(), $category->board->project), 403);
        $data = $request->validate(['name' => ['required', 'string', 'max:80']]);
        $category->update(['name' => $data['name']]);
        $category->board->touchRevision();

        return response()->json([
            'id' => $category->id,
            'name' => $category->name,
            'position' => $category->position,
        ]);
    }

    public function destroyCategory(Request $request, BoardCategory $category)
    {
        abort_unless(ProjectAccess::canManageBoards($request->user(), $category->board->project), 403);
        $board = $category->board;
        $category->delete();
        $board->touchRevision();

        return response()->noContent();
    }

    public function storeCard(Request $request, Board $board)
    {
        $project = $board->project;
        abort_unless(ProjectAccess::canCreateCards($request->user(), $project), 403);

        $data = $request->validate([
            'column_id' => ['required', 'integer'],
            'category_id' => ['nullable', 'integer'],
            'title' => ['required', 'string', 'max:180'],
            'description' => ['nullable', 'string'],
            'start_date' => ['nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'priority' => ['sometimes', Rule::in(['baja', 'media', 'alta', 'urgente'])],
            'is_milestone' => ['sometimes', 'boolean'],
            'milestone_auto_complete' => ['sometimes', 'boolean'],
            'color' => ['sometimes', 'nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'assignee_ids' => ['sometimes', 'array'],
            'assignee_ids.*' => ['integer'],
            'team_ids' => ['sometimes', 'array'],
            'team_ids.*' => ['integer'],
            'label_ids' => ['sometimes', 'array'],
            'label_ids.*' => ['integer'],
        ]);

        if (array_key_exists('assignee_ids', $data) || array_key_exists('team_ids', $data)) {
            abort_unless(ProjectAccess::canAssignCards($request->user(), $project), 403);
        }
        if (! empty($data['start_date']) || ! empty($data['due_date'])) {
            abort_unless(ProjectAccess::canChangeDates($request->user(), $project), 403);
        }
        $column = Column::where('board_id', $board->id)->findOrFail($data['column_id']);
        $isMilestone = (bool) ($data['is_milestone'] ?? false);
        if ($isMilestone) {
            if (empty($data['due_date'])) {
                throw ValidationException::withMessages(['due_date' => 'Un hito necesita una fecha objetivo.']);
            }
            $column = $board->columns()->where('workflow_state', 'in_progress')->orderBy('position')->first();
            if (! $column) {
                throw ValidationException::withMessages(['is_milestone' => 'El tablero necesita una columna En progreso.']);
            }
            $data['start_date'] = $data['due_date'];
        }
        if ($column->workflow_state === 'backlog' && $this->hasPlannedDates($data)) {
            throw ValidationException::withMessages([
                'start_date' => 'Las tarjetas en backlog no pueden tener fechas planificadas.',
            ]);
        }
        $categoryId = null;
        if (! empty($data['category_id'])) {
            $categoryId = BoardCategory::where('board_id', $board->id)->whereKey($data['category_id'])->value('id');
            abort_unless($categoryId, 422);
        }
        $position = Card::where('column_id', $column->id)->whereNull('archived_at')->count();
        if ($column->workflow_state !== 'backlog') {
            $this->validatePlannedDates($data['start_date'] ?? null, $data['due_date'] ?? null);
        }

        $card = Card::create([
            'board_id' => $board->id,
            'column_id' => $column->id,
            'category_id' => $categoryId,
            'title' => $data['title'],
            'description' => $data['description'] ?? null,
            'start_date' => $column->workflow_state === 'backlog' ? null : ($data['start_date'] ?? null),
            'due_date' => $column->workflow_state === 'backlog' ? null : ($data['due_date'] ?? null),
            'started_at' => in_array($column->workflow_state, ['in_progress', 'review', 'done'], true) ? now() : null,
            'completed_at' => in_array($column->workflow_state, ['review', 'done'], true) ? now() : null,
            'position' => $position,
            'is_internal' => true,
            'is_milestone' => $isMilestone,
            'milestone_auto_complete' => (bool) ($data['milestone_auto_complete'] ?? true),
            'priority' => $data['priority'] ?? 'media',
            'color' => $data['color'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        $allowed = $project->members()->whereIn('role', ['responsable', 'editor', 'lector'])->pluck('user_id');
        $assignees = collect($data['assignee_ids'] ?? [])->intersect($allowed);
        $card->assignees()->sync($assignees);
        $labels = Label::where('project_id', $project->id)->whereIn('id', $data['label_ids'] ?? [])->pluck('id');
        $card->labels()->sync($labels);
        foreach (User::whereIn('id', $assignees)->get() as $assignee) {
            Notifier::send($assignee, 'Te han asignado «'.$card->title.'».', $card, 'assignment');
        }
        $this->syncCardTeams($card, $project, $data['team_ids'] ?? [], $assignees, $request->user());

        $card->activities()->create([
            'user_id' => $request->user()->id,
            'type' => 'created',
            'meta' => ['title' => $card->title],
        ]);
        $board->touchRevision();

        return response()->json(['id' => $card->id], 201);
    }

    public function updateCard(Request $request, Card $card, CardDependencyService $dependencies, MilestoneCompletionService $milestones)
    {
        $project = $card->board->project;
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:180'],
            'description' => ['nullable', 'string'],
            'start_date' => ['sometimes', 'nullable', 'date'],
            'due_date' => ['nullable', 'date'],
            'started_at' => ['sometimes', 'nullable', 'date'],
            'completed_at' => ['sometimes', 'nullable', 'date'],
            'priority' => ['sometimes', Rule::in(['baja', 'media', 'alta', 'urgente'])],
            'is_milestone' => ['sometimes', 'boolean'],
            'milestone_auto_complete' => ['sometimes', 'boolean'],
            'is_internal' => ['sometimes', 'boolean'],
            'category_id' => ['sometimes', 'nullable', 'integer'],
            'color' => ['sometimes', 'nullable', 'string', 'regex:/^#[0-9A-Fa-f]{6}$/'],
            'assignee_ids' => ['sometimes', 'array'],
            'assignee_ids.*' => ['integer'],
            'team_ids' => ['sometimes', 'array'],
            'team_ids.*' => ['integer'],
            'label_ids' => ['sometimes', 'array'],
            'label_ids.*' => ['integer'],
        ]);

        $independentFields = ['assignee_ids', 'team_ids', 'start_date', 'due_date', 'started_at', 'completed_at'];
        if (array_diff(array_keys($data), $independentFields)) {
            abort_unless(ProjectAccess::canEditCards($request->user(), $project), 403);
        }
        if (array_key_exists('assignee_ids', $data) || array_key_exists('team_ids', $data)) {
            abort_unless(ProjectAccess::canAssignCards($request->user(), $project), 403);
        }
        if (array_intersect(['start_date', 'due_date', 'started_at', 'completed_at'], array_keys($data))) {
            abort_unless(ProjectAccess::canChangeDates($request->user(), $project), 403);
        }
        if (array_key_exists('is_milestone', $data) && (bool) $data['is_milestone'] !== (bool) $card->is_milestone) {
            abort_unless(ProjectAccess::canChangeState($request->user(), $project), 403);
        }
        $isMilestone = (bool) ($data['is_milestone'] ?? $card->is_milestone);
        $becomingMilestone = $isMilestone && ! $card->is_milestone;
        $progressColumn = null;
        if ($isMilestone) {
            $dueDate = array_key_exists('due_date', $data) ? $data['due_date'] : $card->due_date?->toDateString();
            if (! $dueDate) {
                throw ValidationException::withMessages(['due_date' => 'Un hito necesita una fecha objetivo.']);
            }
            if ($becomingMilestone || array_key_exists('due_date', $data) || array_key_exists('start_date', $data)) {
                $data['start_date'] = $dueDate;
            }
            if ($becomingMilestone) {
                $progressColumn = $card->board->columns()->where('workflow_state', 'in_progress')->orderBy('position')->first();
                if (! $progressColumn) {
                    throw ValidationException::withMessages(['is_milestone' => 'El tablero necesita una columna En progreso.']);
                }
            }
        }
        if ($card->column->workflow_state === 'backlog' && ! $becomingMilestone && $this->hasPlannedDates($data)) {
            throw ValidationException::withMessages(['start_date' => 'Las tarjetas en backlog no pueden tener fechas planificadas.']);
        }

        $previous = $card->assignees()->pluck('users.id');
        $this->validatePlannedDates(
            array_key_exists('start_date', $data) ? $data['start_date'] : $card->start_date?->toDateString(),
            array_key_exists('due_date', $data) ? $data['due_date'] : $card->due_date?->toDateString()
        );
        $fields = collect($data)->except(['assignee_ids', 'team_ids', 'label_ids', 'category_id'])->all();
        if ($becomingMilestone) {
            $fields['started_at'] = $card->started_at ?? now();
            $fields['completed_at'] = null;
            if ($progressColumn->id !== $card->column_id) {
                $fields['column_id'] = $progressColumn->id;
                $fields['position'] = Card::where('column_id', $progressColumn->id)->whereNull('archived_at')->count();
            }
        }
        if ($card->column->workflow_state === 'backlog' && ! $becomingMilestone) {
            $fields['start_date'] = null;
            $fields['due_date'] = null;
        }
        if (array_key_exists('category_id', $data)) {
            if ($data['category_id'] === null) {
                $fields['category_id'] = null;
            } else {
                $categoryId = BoardCategory::where('board_id', $card->board_id)->whereKey($data['category_id'])->value('id');
                abort_unless($categoryId, 422);
                $fields['category_id'] = $categoryId;
            }
        }
        DB::transaction(function () use ($card, $fields, $becomingMilestone, $progressColumn, $request): void {
            $oldColumnId = $card->column_id;
            $card->update($fields);
            if ($becomingMilestone && $progressColumn && $oldColumnId !== $progressColumn->id) {
                $this->resequence($progressColumn->id, $card, $card->position);
                $this->resequence($oldColumnId, null, 0);
                $card->activities()->create([
                    'user_id' => $request->user()->id,
                    'type' => 'moved',
                    'meta' => ['column' => $progressColumn->name],
                ]);
            }
        });
        $affectedBoardIds = [$card->board_id];
        if (array_key_exists('start_date', $data) || array_key_exists('due_date', $data)) {
            $affectedBoardIds = array_merge($affectedBoardIds, $dependencies->propagate($card->fresh()));
        }

        if (array_key_exists('is_internal', $data) && $data['is_internal'] === true) {
            $card->comments()->where('is_internal', false)->update(['is_internal' => true]);
        }

        $notified = collect();

        if (array_key_exists('assignee_ids', $data)) {
            $allowed = $project->members()->whereIn('role', ['responsable', 'editor', 'lector'])->pluck('user_id');
            $ids = collect($data['assignee_ids'])->intersect($allowed)->all();
            $card->assignees()->sync($ids);
            $notified = collect($ids)->diff($previous);
            foreach (User::whereIn('id', $notified)->get() as $assignee) {
                Notifier::send($assignee, 'Te han asignado «'.$card->title.'».', $card, 'assignment');
            }
            $card->activities()->create([
                'user_id' => $request->user()->id,
                'type' => 'assigned',
                'meta' => ['ids' => $ids],
            ]);
        }

        if (array_key_exists('team_ids', $data)) {
            $this->syncCardTeams($card, $project, $data['team_ids'], $notified, $request->user());
        }

        if (array_key_exists('label_ids', $data)) {
            $ids = Label::where('project_id', $project->id)->whereIn('id', $data['label_ids'])->pluck('id');
            $card->labels()->sync($ids);
        }

        $this->touchBoards($affectedBoardIds);
        if ($card->fresh()->is_milestone) {
            $milestones->evaluate($card, $request->user()->id);
        }

        return response()->noContent();
    }

    public function moveCard(Request $request, Card $card, CardDependencyService $dependencies, CardBacklogService $backlog, MilestoneCompletionService $milestones)
    {
        $project = $card->board->project;
        abort_unless(ProjectAccess::canChangeState($request->user(), $project), 403);

        $data = $request->validate([
            'column_id' => ['required', 'integer'],
            'position' => ['required', 'integer', 'min:0'],
            'backlog_resolution' => ['sometimes', 'array'],
            'backlog_resolution.selected_card_ids' => [
                Rule::requiredIf(fn (): bool => $request->exists('backlog_resolution')),
                'array',
                'min:1',
            ],
            'backlog_resolution.selected_card_ids.*' => ['integer', 'distinct'],
            'backlog_resolution.destinations' => ['sometimes', 'array'],
            'backlog_resolution.destinations.*.board_id' => ['required', 'integer', 'distinct'],
            'backlog_resolution.destinations.*.column_id' => ['required', 'integer'],
        ]);

        $column = Column::where('board_id', $card->board_id)->findOrFail($data['column_id']);
        if ($card->is_milestone && $column->workflow_state === 'backlog') {
            throw ValidationException::withMessages(['column_id' => 'Desmarca el hito antes de mover la Card a Backlog.']);
        }
        if ($column->workflow_state === 'backlog') {
            if ($backlog->hasDependencies($card) && ! array_key_exists('backlog_resolution', $data)) {
                return response()->json([
                    'code' => 'backlog_dependencies',
                    'message' => 'La Card tiene dependencias que deben resolverse antes de moverla a Backlog.',
                    'resolution' => $backlog->preview($card, $column),
                ], 409);
            }

            if (array_key_exists('backlog_resolution', $data)) {
                $backlog->execute($card, $column, $request->input('backlog_resolution', []), $request->user()->id, $data['position']);

                return response()->noContent();
            }
        }
        $from = $card->column_id;
        $previousWorkflowState = $card->column->workflow_state;

        $affectedBoardIds = [$card->board_id];

        DB::transaction(function () use ($card, $column, $data, $request, $from, $dependencies, &$affectedBoardIds) {
            $toState = $column->workflow_state;
            $card->column_id = $column->id;
            $affectedBoardIds = array_merge(
                $affectedBoardIds,
                $this->applyWorkflowState($card, $toState, $dependencies)
            );
            $this->resequence($column->id, $card, $data['position']);
            if ($from !== $column->id) {
                $this->resequence($from, null, 0);
                $card->activities()->create([
                    'user_id' => $request->user()->id,
                    'type' => 'moved',
                    'meta' => ['column' => $column->name],
                ]);
            }
        });
        $this->touchBoards($affectedBoardIds);
        if ($previousWorkflowState !== 'done' && $column->workflow_state === 'done') {
            $milestones->evaluateSuccessors($card, $request->user()->id);
        }

        return response()->noContent();
    }

    private function applyWorkflowState(Card $card, string $workflowState, CardDependencyService $dependencies): array
    {
        if ($workflowState === 'backlog') {
            $card->start_date = null;
            $card->due_date = null;
            $card->completed_at = null;
            $card->save();
            return $dependencies->propagate($card->fresh());
        }

        if (in_array($workflowState, ['in_progress', 'review', 'done'], true) && $card->started_at === null) {
            $card->started_at = now();
        }

        if (in_array($workflowState, ['backlog', 'pending', 'in_progress'], true)) {
            $card->completed_at = null;
        } elseif (in_array($workflowState, ['review', 'done'], true) && $card->completed_at === null) {
            $card->completed_at = now();
        }

        $card->save();

        return [];
    }

    private function touchBoards(array $boardIds): void
    {
        Board::whereIn('id', array_values(array_unique($boardIds)))
            ->get()
            ->each(fn (Board $board) => $board->touchRevision());
    }

    private function hasPlannedDates(array $data): bool
    {
        return (array_key_exists('start_date', $data) && $data['start_date'] !== null)
            || (array_key_exists('due_date', $data) && $data['due_date'] !== null);
    }

    private function validatePlannedDates(?string $start, ?string $due): void
    {
        if ($due !== null && $start === null) {
            throw ValidationException::withMessages(['start_date' => 'La fecha de inicio es obligatoria si existe fecha de vencimiento.']);
        }
        if ($start !== null && $due !== null && $start > $due) {
            throw ValidationException::withMessages(['start_date' => 'La fecha de inicio no puede ser posterior a la fecha de vencimiento.']);
        }
    }

    public function archiveCard(Request $request, Card $card)
    {
        abort_unless(ProjectAccess::canDeleteCards($request->user(), $card->board->project), 403);
        $card->update(['archived_at' => now()]);
        $card->board->touchRevision();

        return response()->noContent();
    }

    public function destroyCard(Request $request, Card $card)
    {
        abort_unless(ProjectAccess::canDeleteCards($request->user(), $card->board->project), 403);
        $board = $card->board;
        $paths = $card->attachments()->pluck('disk_path')->all();
        $card->delete();
        ProjectFileStorage::purgePaths($paths);
        $board->touchRevision();

        return response()->noContent();
    }
}
